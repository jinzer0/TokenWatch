// allow: SIZE_OK - heatmap service and renderer contract regressions share one report fixture surface.
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
  it('accepts years 1970 and 9998 and includes both calendar boundaries', async () => {
    // Given: the authoritative lower and upper supported years.
    const { HeatmapService } = await loadHeatmapService();
    const service = new HeatmapService();

    // When: reports are requested at both accepted boundaries.
    const reports = [1970, 9998].map((year) => service.buildReport([], { year, metric: 'tokens' }));

    // Then: accepted years contain Jan 1 through Dec 31.
    expect(reports.map((report) => [report.days[0]?.date, report.days.at(-1)?.date])).toEqual([
      ['1970-01-01', '1970-12-31'],
      ['9998-01-01', '9998-12-31']
    ]);
  });

  it.each([1969, 9999, 10000])(
    'rejects unsupported year %i at the service boundary',
    async (year) => {
      // Given: a year outside the authoritative 1970 through 9998 range.
      const { HeatmapService } = await loadHeatmapService();

      // When: an unsupported year is used to build a report.
      const build = () => new HeatmapService().buildReport([], { year, metric: 'tokens' });

      // Then: the service emits its bounded validation code.
      expect(build).toThrow('invalid_report_option');
    }
  );

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
    expect(
      new HeatmapService().buildReport([], { year: 2025, metric: 'tokens' }).days
    ).toHaveLength(365);
    expect(
      new HeatmapService().buildReport([], { year: 2026, metric: 'tokens' }).days
    ).toHaveLength(365);
  });

  it('assigns deterministic positive threshold levels one through five', async () => {
    // Given: five days whose token totals are exact fifths of the maximum.
    const { HeatmapService } = await loadHeatmapService();
    const events = [20, 40, 60, 80, 100].map((totalTokens, index) =>
      createTestEvent({
        timestamp: `2026-03-0${index + 1}T00:00:00.000Z`,
        rawIdHash: `level-${index + 1}`,
        inputTokens: totalTokens,
        outputTokens: 0,
        totalTokens,
        estimatedCostUsd: 0.01
      })
    );

    // When: the token heatmap is built.
    const report = new HeatmapService().buildReport(events, { year: 2026, metric: 'tokens' });

    // Then: each positive threshold maps deterministically to its matching level.
    expect(report.days.slice(59, 64).map(({ level }) => level)).toEqual([1, 2, 3, 4, 5]);
  });

  it('uses tokens, event count, and known cost as the selected metric value', async () => {
    // Given: two known-cost events on one UTC day.
    const { HeatmapService } = await loadHeatmapService();
    const service = new HeatmapService();
    const events = [
      createTestEvent({
        timestamp: '2026-04-01T01:00:00.000Z',
        rawIdHash: 'metric-a',
        inputTokens: 30,
        outputTokens: 10,
        totalTokens: 40,
        estimatedCostUsd: 0.1
      }),
      createTestEvent({
        timestamp: '2026-04-01T02:00:00.000Z',
        rawIdHash: 'metric-b',
        inputTokens: 45,
        outputTokens: 15,
        totalTokens: 60,
        estimatedCostUsd: 0.2
      })
    ];

    // When: each supported metric projects the same aggregate day.
    const values = (['tokens', 'events', 'cost'] as const).map(
      (metric) =>
        service
          .buildReport(events, { year: 2026, metric })
          .days.find(({ date }) => date === '2026-04-01')?.value
    );

    // Then: value follows the selected metric without changing the underlying day.
    expect(values.slice(0, 2)).toEqual([100, 2]);
    expect(values[2]).toBeCloseTo(0.3);
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
    expect(report.totals).toEqual({
      events: 0,
      totalTokens: 0,
      estimatedCostUsd: null,
      unknownCostEvents: 0
    });
    expect(
      report.days.every(
        ({ events, totalTokens, value }) => events === 0 && totalTokens === 0 && value === 0
      )
    ).toBe(true);
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

  it('renders complete text semantics without presenting unknown cost as free', async () => {
    // Given: an all-unknown-cost report with selected aggregate filters.
    const [{ HeatmapService }, { renderHeatmapText }] = await Promise.all([
      loadHeatmapService(),
      loadTextRenderer()
    ]);
    const report = new HeatmapService().buildReport(
      [
        {
          ...createTestEvent({
            timestamp: '2026-04-05T00:00:00.000Z',
            rawIdHash: 'text-privacy',
            totalTokens: 140
          }),
          estimatedCostUsd: null,
          rawSource: 'RAW_SESSION_SENTINEL_DO_NOT_LEAK',
          metadata: {
            prompt: 'PROMPT_SENTINEL_DO_NOT_LEAK',
            response: 'RESPONSE_SENTINEL_DO_NOT_LEAK',
            path: 'RAW_PATH_SENTINEL_DO_NOT_LEAK'
          }
        }
      ],
      {
        year: 2026,
        metric: 'cost',
        filters: { source: ['codex'], sourceName: ['lab-server'] }
      }
    );

    // When: the terminal renderer consumes the sanitized report DTO.
    const text = renderHeatmapText(report);

    // Then: every report semantic is visible and uncertainty is never described as zero/free.
    expect(text).toContain('Year: 2026');
    expect(text).toContain('Metric: cost');
    expect(text).toContain('Range: 2026-01-01 to 2026-12-31');
    expect(text).toContain('Filters: source=codex | sourceName=lab-server');
    expect(text).toContain('Summary: 1 events, 140 tokens, unknown cost, unknownCostEvents: 1');
    expect(text).toContain(
      'Legend: ·=No usage ▁=Very low usage ▂=Low usage ▃=Medium usage ▅=High usage █=Peak usage'
    );
    expect(text).not.toMatch(/\$0(?:\.0+)?|\bfree\b|\b(?:zero|no) cost\b/i);
    assertJsonOutputPrivacy(report);
    assertNoForbiddenOutput(text);
    expect(containsPrivacySentinel(report)).toBe(false);
  });

  it('renders one unique date-bearing SVG day cell per report day with visible semantics', async () => {
    // Given: a filtered all-unknown-cost report built from synthetic privacy sentinels.
    const [{ HeatmapService }, { renderHeatmapSvg }] = await Promise.all([
      loadHeatmapService(),
      loadSvgRenderer()
    ]);
    const report = new HeatmapService().buildReport(
      [
        {
          ...createTestEvent({
            timestamp: '2026-04-05T00:00:00.000Z',
            rawIdHash: 'svg-privacy',
            totalTokens: 140
          }),
          estimatedCostUsd: null,
          rawSource: 'RAW_SESSION_SENTINEL_DO_NOT_LEAK',
          metadata: { path: 'RAW_PATH_SENTINEL_DO_NOT_LEAK' }
        }
      ],
      {
        year: 2026,
        metric: 'cost',
        filters: { source: ['codex'], sourceName: ['lab-server'] }
      }
    );

    // When: the SVG renderer consumes the sanitized report DTO.
    const svg = renderHeatmapSvg(report);
    const dayCellDates = [
      ...svg.matchAll(/<rect\b[^>]*><title>(\d{4}-\d{2}-\d{2})\b[^<]*<\/title><\/rect>/g)
    ]
      .map((match) => match[1])
      .filter((date): date is string => date !== undefined);

    // Then: titled day cells exclude background/legend rectangles and expose the full report context.
    expect(dayCellDates).toEqual(report.days.map(({ date }) => date));
    expect(new Set(dayCellDates)).toHaveLength(report.days.length);
    expect(svg).toContain('Year 2026 | Metric cost | 1 events | 140 tokens | unknown cost');
    expect(svg).toContain('Range 2026-01-01 to 2026-12-31');
    expect(svg).toContain('Filters: source=codex | sourceName=lab-server');
    expect(svg).toContain('unknownCostEvents: 1');
    for (const { symbol, label } of report.legend) {
      expect.soft(svg).toContain(`${symbol} ${label}`);
    }
    expect(svg).not.toMatch(/\$0(?:\.0+)?|\bfree\b|\b(?:zero|no) cost\b/i);
    expect(svg).not.toMatch(/<script\b|<image\b|<link\b|\bhref\s*=|\bsrc\s*=|@import|url\s*\(/i);
    assertNoForbiddenOutput(svg);
  });

  it('escapes SVG title and filter labels as XML text', async () => {
    // Given: synthetic renderer inputs containing every XML-sensitive character.
    const [{ HeatmapService }, { renderHeatmapSvg }] = await Promise.all([
      loadHeatmapService(),
      loadSvgRenderer()
    ]);
    const report = new HeatmapService().buildReport([], { year: 2026, metric: 'events' });
    const reportWithXmlLabels = {
      ...report,
      filters: {
        source: ['synthetic<&"source'],
        sourceName: ["lab>'&name"]
      }
    };

    // When: user-controlled display labels and title are rendered into SVG.
    const svg = renderHeatmapSvg(reportWithXmlLabels, {
      title: 'Synthetic <title> & "quoted" \'value\''
    });

    // Then: text is entity-escaped and cannot create markup or external references.
    expect(svg).toContain('Synthetic &lt;title&gt; &amp; &quot;quoted&quot; &apos;value&apos;');
    expect(svg).toContain('source=synthetic&lt;&amp;&quot;source');
    expect(svg).toContain('sourceName=lab&gt;&apos;&amp;name');
    expect(svg).not.toContain('<title> &');
    expect(svg).not.toMatch(/<script\b|<image\b|<link\b|\bhref\s*=|\bsrc\s*=|@import|url\s*\(/i);
  });
});
