import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type TokenWatchDb } from '../src/db/client.js';
import { BudgetThresholdsRepository } from '../src/db/repositories/budgetThresholds.js';
import { UsageEventsRepository } from '../src/db/repositories/usageEvents.js';
import { BudgetService, type BudgetEvaluation } from '../src/services/budgetService.js';
import { BudgetStatusService } from '../src/services/budgetStatusService.js';
import { createServices } from '../src/services/container.js';
import { budgetStatusReportSchema } from '../src/services/reportContracts.js';
import { containsPrivacySentinel, createTempDb, createTestEvent } from './helpers.js';

let cleanup: (() => void) | undefined;
let db: TokenWatchDb | undefined;

afterEach(() => {
  db?.close();
  cleanup?.();
  db = undefined;
  cleanup = undefined;
});

describe('budget service', () => {
  it('sets, lists, unsets, and validates threshold scopes', () => {
    const service = setupBudgetService().budget;

    expect(
      service.setThreshold({ scopeKind: 'monthly_total', thresholdUsd: 10, sourceName: null })
    ).toMatchObject({ scopeKind: 'monthly_total', sourceName: null, thresholdUsd: 10 });
    expect(
      service.setThreshold({ scopeKind: 'sourceName', sourceName: ' lab-a100 ', thresholdUsd: 3.5 })
    ).toMatchObject({ scopeKind: 'sourceName', sourceName: 'lab-a100', thresholdUsd: 3.5 });
    expect(service.listThresholds()).toHaveLength(2);
    expect(service.unsetThreshold('sourceName', 'lab-a100')).toBe(true);
    expect(service.unsetThreshold('sourceName', 'lab-a100')).toBe(false);
    expect(service.listThresholds().map((threshold) => threshold.scopeKind)).toEqual([
      'monthly_total'
    ]);

    expect(() =>
      service.setThreshold({ scopeKind: 'monthly_total', sourceName: 'local', thresholdUsd: 1 })
    ).toThrow('invalid_budget_scope');
    expect(() => service.setThreshold({ scopeKind: 'sourceName', thresholdUsd: 1 })).toThrow(
      'invalid_budget_scope'
    );
    expect(() =>
      service.setThreshold({ scopeKind: 'sourceName', sourceName: 'bad value', thresholdUsd: 1 })
    ).toThrow();
    expect(() =>
      service.setThreshold({
        scopeKind: 'sourceName',
        sourceName: 'FAKE_API_KEY_SENTINEL_DO_NOT_LEAK',
        thresholdUsd: 1
      })
    ).toThrow();
    expect(() => service.setThreshold({ scopeKind: 'monthly_total', thresholdUsd: 0 })).toThrow(
      'invalid_budget_threshold'
    );
  });

  it('adapts evaluations to canonical budget status rows with deterministic progress', () => {
    const service = new BudgetStatusService();
    const evaluations: BudgetEvaluation[] = [
      budgetEvaluation({ sourceName: 'ok-lab', knownSpendUsd: 79, thresholdUsd: 100 }),
      budgetEvaluation({ sourceName: 'warning-lab', knownSpendUsd: 80, thresholdUsd: 100 }),
      budgetEvaluation({
        sourceName: 'exceeded-lab',
        knownSpendUsd: 125,
        thresholdUsd: 100,
        status: 'over',
        unknownCostEventCount: 1,
        unknownCostTokenCount: 50,
        warningCodes: ['budget_threshold_exceeded', 'budget_unknown_cost_present']
      }),
      budgetEvaluation({
        sourceName: 'unknown-lab',
        knownSpendUsd: 0.2,
        thresholdUsd: 0.3,
        status: 'unknown-costs-present',
        unknownCostEventCount: 2,
        unknownCostTokenCount: 120,
        warningCodes: ['budget_unknown_cost_present']
      })
    ];

    const report = service.buildReport(evaluations, {
      now: new Date('2026-05-20T12:00:00.000Z'),
      progressWidth: 10
    });

    expect(report.summary).toEqual({ total: 4, ok: 1, warning: 1, exceeded: 1, unknown: 1 });
    expect(report.rows.map((row) => row.status)).toEqual(['ok', 'warning', 'exceeded', 'unknown']);
    expect(report.rows[0]).toMatchObject({
      label: 'ok-lab',
      percent: 79,
      progress: { width: 10, filled: 7, empty: 3, label: '79%' }
    });
    expect(report.rows[1]).toMatchObject({
      percent: 80,
      progress: { width: 10, filled: 8, empty: 2, label: '80%' }
    });
    expect(report.rows[2]).toMatchObject({
      percent: 125,
      progress: { width: 10, filled: 10, empty: 0, label: '125%' },
      unknownCostEvents: 1,
      warnings: ['budget_threshold_exceeded', 'budget_unknown_cost_present']
    });
    expect(report.rows[3]).toMatchObject({
      knownSpendUsd: 0.2,
      thresholdUsd: 0.3,
      percent: 66.7,
      progress: { width: 10, filled: 6, empty: 4, label: '66.7% + unknown cost' },
      unknownCostEvents: 2,
      unknownCostTokens: 120,
      warnings: ['budget_unknown_cost_present']
    });
    expect(JSON.stringify(report)).not.toContain('$0.00');
    expect(budgetStatusReportSchema.parse(report)).toEqual(report);
  });

  it('rejects invalid progress widths and non-positive thresholds before progress math', () => {
    const service = new BudgetStatusService();
    const evaluation = budgetEvaluation({ thresholdUsd: 1 });

    expect(() => service.buildRows([evaluation], { progressWidth: -1 })).toThrow(
      'invalid_budget_progress_width'
    );
    expect(() => service.buildRows([budgetEvaluation({ thresholdUsd: 0 })])).toThrow(
      'invalid_budget_threshold'
    );
  });

  it('rejects unsafe budget labels when building rows for TUI consumers', () => {
    expect(() =>
      new BudgetStatusService().buildRows([
        budgetEvaluation({ sourceName: 'RAW_PATH_SENTINEL_DO_NOT_LEAK' })
      ])
    ).toThrow('headless_payload_rejected');
  });

  it('evaluates current local month totals and sourceName thresholds without zeroing unknown costs', () => {
    const { budget, usageEvents } = setupBudgetService();
    budget.setThreshold({ scopeKind: 'monthly_total', thresholdUsd: 1 });
    budget.setThreshold({ scopeKind: 'sourceName', sourceName: 'local', thresholdUsd: 0.6 });
    usageEvents.insertMany([
      createKnownCostEvent('known-local', '2026-05-10T10:00:00.000Z', 'local', 0.4, 100),
      createUnknownCostEvent('unknown-local', '2026-05-11T10:00:00.000Z', 'local', 50),
      createKnownCostEvent('known-lab', '2026-05-12T10:00:00.000Z', 'lab-a100', 0.7, 200),
      createKnownCostEvent('old-local', '2026-04-12T10:00:00.000Z', 'local', 99, 300)
    ]);

    const evaluations = budget.evaluateCurrentMonth(new Date(2026, 4, 20, 12));
    const monthlyTotal = evaluations.find((item) => item.scopeKind === 'monthly_total');
    const local = evaluations.find((item) => item.sourceName === 'local');

    expect(monthlyTotal).toMatchObject({
      month: '2026-05',
      knownSpendUsd: 1.1,
      thresholdUsd: 1,
      status: 'over',
      unknownCostEventCount: 1,
      unknownCostTokenCount: 50
    });
    expect(monthlyTotal?.warningRows.map((row) => row.code)).toEqual([
      'budget_threshold_exceeded',
      'budget_unknown_cost_present'
    ]);
    expect(local).toMatchObject({
      month: '2026-05',
      knownSpendUsd: 0.4,
      thresholdUsd: 0.6,
      status: 'unknown-costs-present',
      unknownCostEventCount: 1,
      unknownCostTokenCount: 50
    });
    expect(containsPrivacySentinel(evaluations)).toBe(false);
  });

  it('uses local month bucket semantics at month boundaries', () => {
    const { budget, usageEvents } = setupBudgetService();
    const mayTimestamp = new Date(2026, 4, 31, 23, 30).toISOString();
    const juneTimestamp = new Date(2026, 5, 1, 0, 30).toISOString();
    budget.setThreshold({ scopeKind: 'monthly_total', thresholdUsd: 1 });
    usageEvents.insertMany([
      createKnownCostEvent('may-row', mayTimestamp, 'local', 0.5, 100),
      createKnownCostEvent('june-row', juneTimestamp, 'local', 2, 100)
    ]);

    expect(budget.evaluateCurrentMonth(new Date(2026, 4, 31, 23, 45))[0]).toMatchObject({
      month: '2026-05',
      knownSpendUsd: 0.5,
      status: 'ok'
    });
    expect(budget.evaluateCurrentMonth(new Date(2026, 5, 1, 0, 45))[0]).toMatchObject({
      month: '2026-06',
      knownSpendUsd: 2,
      status: 'over'
    });
  });

  it('wires budget service through createServices', () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);

    const services = createServices(db);

    expect(
      services.budget.setThreshold({ scopeKind: 'monthly_total', thresholdUsd: 5 })
    ).toMatchObject({ thresholdUsd: 5 });
    expect(services.budgetThresholds.list()).toHaveLength(1);
  });
});

function setupBudgetService() {
  const temp = createTempDb();
  cleanup = temp.cleanup;
  db = openDatabase(temp.dbPath);
  const usageEvents = new UsageEventsRepository(db);
  const budget = new BudgetService(new BudgetThresholdsRepository(db), usageEvents);
  return { budget, usageEvents };
}

function createKnownCostEvent(
  rawIdHash: string,
  timestamp: string,
  sourceName: string,
  estimatedCostUsd: number,
  totalTokens: number
) {
  return createTestEvent({
    timestamp,
    sourceName,
    inputTokens: totalTokens,
    outputTokens: 0,
    cachedTokens: 0,
    totalTokens,
    rawIdHash,
    estimatedCostUsd
  });
}

function createUnknownCostEvent(
  rawIdHash: string,
  timestamp: string,
  sourceName: string,
  totalTokens: number
) {
  return {
    ...createKnownCostEvent(rawIdHash, timestamp, sourceName, 1, totalTokens),
    estimatedCostUsd: null
  };
}

function budgetEvaluation(
  overrides: Partial<BudgetEvaluation> & {
    readonly warningCodes?: BudgetEvaluation['warningRows'][number]['code'][];
  }
): BudgetEvaluation {
  const scopeKind = overrides.scopeKind ?? 'sourceName';
  const sourceName = 'sourceName' in overrides ? (overrides.sourceName ?? null) : 'local';
  const warningCodes = overrides.warningCodes ?? [];
  return {
    scopeKind,
    sourceName,
    month: overrides.month ?? '2026-05',
    knownSpendUsd: overrides.knownSpendUsd ?? 0,
    thresholdUsd: overrides.thresholdUsd ?? 1,
    status: overrides.status ?? 'ok',
    unknownCostEventCount: overrides.unknownCostEventCount ?? 0,
    unknownCostTokenCount: overrides.unknownCostTokenCount ?? 0,
    warningRows: warningCodes.map((code) => ({ code, scopeKind, sourceName }))
  };
}
