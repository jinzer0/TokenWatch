import { validateSourceName as validateSourceNameValue } from '../../privacy.js';
import type { TokenWatchDb } from '../client.js';

export type BudgetScopeKind = 'monthly_total' | 'sourceName';

export type BudgetThreshold = {
  id: string;
  scopeKind: BudgetScopeKind;
  sourceName: string | null;
  thresholdUsd: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BudgetThresholdInput = {
  scopeKind: BudgetScopeKind;
  sourceName?: string | null;
  thresholdUsd: number;
  enabled?: boolean;
};

type BudgetThresholdRow = {
  id: string;
  scope_kind: string;
  source_name: string | null;
  threshold_usd: number;
  enabled: number;
  created_at: string;
  updated_at: string;
};

export class BudgetThresholdsRepository {
  constructor(private readonly db: TokenWatchDb) {}

  set(input: BudgetThresholdInput): BudgetThreshold {
    const normalized = normalizeThresholdInput(input);
    const existing = this.get(normalized.scopeKind, normalized.sourceName);
    const now = new Date().toISOString();
    const row = {
      id: thresholdId(normalized.scopeKind, normalized.sourceName),
      scope_kind: normalized.scopeKind,
      source_name: normalized.sourceName,
      threshold_usd: normalized.thresholdUsd,
      enabled: normalized.enabled ? 1 : 0,
      created_at: existing?.createdAt ?? now,
      updated_at: now
    };
    this.db
      .prepare(
        `INSERT INTO budget_thresholds (
          id, scope_kind, source_name, threshold_usd, enabled, created_at, updated_at
        ) VALUES (
          @id, @scope_kind, @source_name, @threshold_usd, @enabled, @created_at, @updated_at
        ) ON CONFLICT(id) DO UPDATE SET
          threshold_usd = excluded.threshold_usd,
          enabled = excluded.enabled,
          updated_at = excluded.updated_at`
      )
      .run(row);
    return mapRow(row);
  }

  get(scopeKind: BudgetScopeKind, sourceName?: string | null): BudgetThreshold | null {
    const normalized = normalizeScope(scopeKind, sourceName);
    const row = this.db
      .prepare('SELECT * FROM budget_thresholds WHERE id = ?')
      .get(normalized.id) as BudgetThresholdRow | undefined;
    return row ? mapRow(row) : null;
  }

  list(): BudgetThreshold[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM budget_thresholds
         WHERE enabled = 1
         ORDER BY scope_kind ASC, source_name ASC`
      )
      .all() as BudgetThresholdRow[];
    return rows.map(mapRow);
  }

  unset(scopeKind: BudgetScopeKind, sourceName?: string | null): boolean {
    const normalized = normalizeScope(scopeKind, sourceName);
    const result = this.db.prepare('DELETE FROM budget_thresholds WHERE id = ?').run(normalized.id);
    return result.changes > 0;
  }
}

function normalizeThresholdInput(input: BudgetThresholdInput): Required<BudgetThresholdInput> {
  const scope = normalizeScope(input.scopeKind, input.sourceName);
  if (!Number.isFinite(input.thresholdUsd) || input.thresholdUsd <= 0) {
    throw new Error('invalid_budget_threshold');
  }
  return {
    scopeKind: scope.scopeKind,
    sourceName: scope.sourceName,
    thresholdUsd: input.thresholdUsd,
    enabled: input.enabled ?? true
  };
}

function normalizeScope(scopeKind: BudgetScopeKind, sourceName?: string | null) {
  if (scopeKind !== 'monthly_total' && scopeKind !== 'sourceName') {
    throw new Error('invalid_budget_scope');
  }
  if (scopeKind === 'monthly_total') {
    if (sourceName !== undefined && sourceName !== null && sourceName.trim().length > 0) {
      throw new Error('invalid_budget_scope');
    }
    return { id: thresholdId(scopeKind, null), scopeKind, sourceName: null };
  }
  if (sourceName === undefined || sourceName === null) {
    throw new Error('invalid_budget_scope');
  }
  const normalizedSourceName = validateSourceNameValue(sourceName);
  return {
    id: thresholdId(scopeKind, normalizedSourceName),
    scopeKind,
    sourceName: normalizedSourceName
  };
}

function thresholdId(scopeKind: BudgetScopeKind, sourceName: string | null): string {
  return scopeKind === 'monthly_total' ? 'monthly_total' : `sourceName:${sourceName}`;
}

function mapRow(row: BudgetThresholdRow): BudgetThreshold {
  const scopeKind = row.scope_kind === 'sourceName' ? 'sourceName' : 'monthly_total';
  return {
    id: row.id,
    scopeKind,
    sourceName: row.source_name,
    thresholdUsd: row.threshold_usd,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
