import { describe, expect, it } from 'vitest';
import { heatmapReportSchema } from '../src/services/reportContracts.js';
import { assertJsonOutputPrivacy, assertNoForbiddenOutput } from './privacyOutput.js';
import { containsPrivacySentinel, createTestEvent } from './helpers.js';

async function loadHeatmapService(): Promise<typeof import('../src/services/heatmapService.js')> {
  return import('../src/services/heatmapService.js');
}

async function loadTextRenderer(): Promise<
  typeof import('../src/services/heatmapTextRenderer.js')
> {
  return import('../src/services/heatmapTextRenderer.js');
}

async function loadSvgRenderer(): Promise<typeof import('../src/services/heatmapSvgRenderer.js')> {
  return import('../src/services/heatmapSvgRenderer.js');
}

describe('heatmap report service', () => {
  it('builds a complete UTC year report with deterministic token levels', async () => {
    // Given: events around year and day UTC boundaries.
    const { HeatmapService } = await loadHeatmapService();
    const report = new HeatmapService().buildReport(
      [
        createTestEvent({ timestamp: '2025-12-31T23:59:59.999Z', rawIdHash: 'before-year' }),
        createTestEvent({
          timestamp: '2026-01-01T00:00:00.000Z',
          rawIdHash: 'jan-one-a',
          totalTokens: 20,
          inputTokens: 10,
          outputTokens: 10,
          estimatedCostUsd: 0.02
        }),
        createTestEvent({
          timestamp: '2026-01-01T23:59:59.999Z',
          rawIdHash: 'jan-one-b',
          totalTokens: 1,
          inputTokens: 1,
          outputTokens: 0,
          estimatedCostUsd: 0.01
        }),
        createTestEvent({
          timestamp: '2026-01-02T00:00:00.000Z',
          rawIdHash: 'jan-two',
          totalTokens: 21,
          inputTokens: 11,
          outputTokens: 10,
          estimatedCostUsd: 0.03
        }),
        createTestEvent({
          timestamp: '2026-01-03T12:00:00.000Z',
          rawIdHash: 'jan-three',
          totalTokens: 105,
          inputTokens: 55,
          outputTokens: 50,
          estimatedCostUsd: 0.05
        }),
        createTestEvent({ timestamp: '2027-01-01T00:00:00.000Z', rawIdHash: 'after-year' })
      ],
      { year: 2026, metric: 'tokens' }
    );

    // When: the report is parsed by the shared strict contract.
    const parsed = heatmapReportSchema.parse(report);

    // Then: every UTC day exists and levels follow the required formula.
    expect(parsed).toMatchObject({
      version: 1,
      kind: 'heatmap',
      year: 2026,
      metric: 'tokens',
      range: { from: '2026-01-01T00:00:00.000Z', to: '2027-01-01T00:00:00.000Z' },
      totals: { events: 4, totalTokens: 147, estimatedCostUsd: 0.11, unknownCostEvents: 0 },
      privacy: { sanitized: true }
    });
    expect(parsed.days).toHaveLength(365);
    expect(parsed.days[0]).toMatchObject({ date: '2026-01-01', value: 21, level: 1 });
    expect(parsed.days[1]).toMatchObject({ date: '2026-01-02', value: 21, level: 1 });
    expect(parsed.days[2]).toMatchObject({ date: '2026-01-03', value: 105, level: 5 });
    expect(parsed.days[3]).toMatchObject({ date: '2026-01-04', value: 0, level: 0 });
  });

  it('keeps leap-day zero and maps values just above one fifth to level two', async () => {
    // Given: a leap year with one small positive value and one max value.
    const { HeatmapService } = await loadHeatmapService();
    const report = new HeatmapService().buildReport(
      [
        createTestEvent({
          timestamp: '2024-03-01T00:00:00.000Z',
          rawIdHash: 'small-positive',
          totalTokens: 22,
          inputTokens: 12,
          outputTokens: 10,
          estimatedCostUsd: 0.02
        }),
        createTestEvent({
          timestamp: '2024-03-02T00:00:00.000Z',
          rawIdHash: 'max-positive',
          totalTokens: 105,
          inputTokens: 55,
          outputTokens: 50,
          estimatedCostUsd: 0.05
        })
      ],
      { year: 2024, metric: 'tokens' }
    );

    // When: leap-year days are generated.
    const parsed = heatmapReportSchema.parse(report);

    // Then: leap day stays empty while the formula boundary moves to level 2.
    expect(parsed.days).toHaveLength(366);
    expect(parsed.days.find((day) => day.date === '2024-02-29')).toMatchObject({
      value: 0,
      level: 0
    });
    expect(parsed.days.find((day) => day.date === '2024-03-01')).toMatchObject({
      value: 22,
      level: 2
    });
    expect(parsed.days.find((day) => day.date === '2024-03-02')).toMatchObject({
      value: 105,
      level: 5
    });
  });

  it('projects repeated source and sourceName filters as arrays', async () => {
    // Given: repeated source and sourceName selections at the service boundary.
    const { HeatmapService } = await loadHeatmapService();
    const service = new HeatmapService();

    // When: the filtered heatmap report is built.
    const parsed = heatmapReportSchema.parse(
      Reflect.apply(service.buildReport, service, [
        [],
        {
          year: 2026,
          metric: 'tokens',
          filters: {
            source: ['codex', 'opencode'],
            sourceName: ['lab-one', 'lab-two']
          }
        }
      ])
    );

    // Then: repeated values remain arrays in the output contract.
    expect(parsed).toMatchObject({
      filters: {
        source: ['codex', 'opencode'],
        sourceName: ['lab-one', 'lab-two']
      }
    });
  });

  it('uses the canonical six density symbols', async () => {
    // Given: an otherwise empty heatmap year.
    const { HeatmapService } = await loadHeatmapService();

    // When: its legend is read from the report DTO.
    const report = new HeatmapService().buildReport([], { year: 2026, metric: 'events' });

    // Then: every level maps to the exact terminal-safe density symbol.
    expect(report.legend.map(({ symbol }) => symbol)).toEqual(['·', '▁', '▂', '▃', '▅', '█']);
  });

  it('keeps every all-zero day at numeric level zero', async () => {
    // Given: a non-leap year with no events.
    const { HeatmapService } = await loadHeatmapService();

    // When: the empty year report is built.
    const report = new HeatmapService().buildReport([], { year: 2026, metric: 'cost' });

    // Then: all 365 levels are numeric, non-null, and exactly zero.
    expect(report.days).toHaveLength(365);
    expect(report.days.every(({ level }) => typeof level === 'number' && level === 0)).toBe(true);
  });

  it('excludes unknown costs from spend while counting unknown-cost events', async () => {
    // Given: known and unknown cost events on the same UTC day.
    const { HeatmapService } = await loadHeatmapService();
    const report = new HeatmapService().buildReport(
      [
        createTestEvent({
          timestamp: '2026-02-01T01:00:00.000Z',
          rawIdHash: 'known-cost',
          totalTokens: 100,
          estimatedCostUsd: 0.25
        }),
        {
          ...createTestEvent({ timestamp: '2026-02-01T02:00:00.000Z', rawIdHash: 'unknown-cost' }),
          estimatedCostUsd: null
        }
      ],
      { year: 2026, metric: 'cost' }
    );

    // When: the cost metric report is parsed.
    const parsed = heatmapReportSchema.parse(report);

    // Then: known spend is retained and unknown spend is not converted to zero.
    expect(parsed.totals).toMatchObject({ estimatedCostUsd: 0.25, unknownCostEvents: 1 });
    expect(parsed.days.find((day) => day.date === '2026-02-01')).toMatchObject({
      value: 0.25,
      estimatedCostUsd: 0.25,
      unknownCostEvents: 1,
      level: 5
    });
  });

  it('keeps an all-unknown cost day nullable instead of presenting it as free', async () => {
    // Given: one event whose price is unknown.
    const { HeatmapService } = await loadHeatmapService();
    const unknownCostEvent = {
      ...createTestEvent({ timestamp: '2026-02-02T02:00:00.000Z', rawIdHash: 'unknown-only' }),
      estimatedCostUsd: null
    };

    // When: the cost heatmap is built.
    const report = new HeatmapService().buildReport([unknownCostEvent], {
      year: 2026,
      metric: 'cost'
    });
    const day = report.days.find(({ date }) => date === '2026-02-02');

    // Then: sums exclude the unknown price while the nullable cost and count preserve uncertainty.
    expect(report.totals).toMatchObject({ estimatedCostUsd: null, unknownCostEvents: 1 });
    expect(day).toMatchObject({
      value: 0,
      estimatedCostUsd: null,
      unknownCostEvents: 1,
      level: 0
    });
    expect(JSON.stringify(report)).not.toMatch(/\$0\.00|\bfree\b/i);
  });

  it('renders privacy-safe text and SVG without color-only meaning', async () => {
    // Given: a report built from an event carrying forbidden private metadata sentinels.
    const [{ HeatmapService }, { renderHeatmapText }, { renderHeatmapSvg }] = await Promise.all([
      loadHeatmapService(),
      loadTextRenderer(),
      loadSvgRenderer()
    ]);
    const report = new HeatmapService().buildReport(
      [
        {
          ...createTestEvent({ timestamp: '2026-04-05T00:00:00.000Z', rawIdHash: 'privacy' }),
          rawSource: 'RAW_SESSION_SENTINEL_DO_NOT_LEAK',
          metadata: {
            prompt: 'PROMPT_SENTINEL_DO_NOT_LEAK',
            response: 'RESPONSE_SENTINEL_DO_NOT_LEAK',
            path: 'RAW_PATH_SENTINEL_DO_NOT_LEAK'
          }
        }
      ],
      { year: 2026, metric: 'events' }
    );

    // When: both renderers consume the sanitized DTO.
    const text = renderHeatmapText(report);
    const svg = renderHeatmapSvg(report, { title: 'TokenWatch Heatmap <safe>' });

    // Then: output exposes aggregate context, symbols, and no forbidden data.
    expect(text).toContain('TokenWatch Heatmap');
    expect(text).toContain('Year: 2026');
    expect(text).toContain('Metric: events');
    expect(text).toContain('Range: 2026-01-01 to 2026-12-31');
    expect(text).toContain('Legend:');
    expect(text).toContain('Privacy: sanitized');
    expect(svg).toContain('<svg');
    expect(svg).toContain('TokenWatch Heatmap &lt;safe&gt;');
    assertJsonOutputPrivacy(report);
    assertNoForbiddenOutput(text);
    assertNoForbiddenOutput(svg);
    expect(containsPrivacySentinel(report)).toBe(false);
  });
});
