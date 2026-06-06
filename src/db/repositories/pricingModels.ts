import { createHash } from 'node:crypto';
import { normalizePricingModel } from '../../pricing/normalization.js';
import { containsUnsafePrivacyShape, validateCanonicalField } from '../../privacy.js';
import type { TokenWatchDb } from '../client.js';

export type ExternalPricingSource = 'litellm' | 'openrouter';

type PricingSource = 'custom' | ExternalPricingSource;

export type PricingLookupMatchedSource = PricingSource | 'bundled' | 'cursor' | 'unknown';
export type PricingLookupConfidence =
  | 'exact'
  | 'alias'
  | 'provider-prefix'
  | 'cursor-override'
  | 'fuzzy'
  | 'none';

export type CustomPricingModel = {
  id: string;
  provider: string;
  model: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  cachedInputPricePerMillion: number | null;
  currency: 'USD';
  source: 'custom';
  active: boolean;
  enabled: boolean;
  effectiveFrom: string | null;
};

export type ExternalPricingModel = {
  id: string;
  provider: string;
  model: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  cachedInputPricePerMillion: number | null;
  currency: 'USD';
  source: ExternalPricingSource;
  active: boolean;
  enabled: boolean;
  fetchedAt: string;
};

export type CustomPricingModelInput = {
  provider: string;
  model: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  cachedInputPricePerMillion?: number | null;
  currency?: string;
  active?: boolean;
  enabled?: boolean;
  effectiveFrom?: string | null;
};

export type ExternalPricingModelInput = {
  provider: string;
  model: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  cachedInputPricePerMillion?: number | null;
  active?: boolean;
  enabled?: boolean;
};

export type PricingLookupCacheEntry = {
  cacheKey: string;
  provider: string;
  model: string;
  matchedSource: PricingLookupMatchedSource;
  matchedKey: string | null;
  confidence: PricingLookupConfidence;
  inputPricePerMillion: number | null;
  outputPricePerMillion: number | null;
  cachedInputPricePerMillion: number | null;
  fetchedAt: string;
  updatedAt: string;
  noMatch: boolean;
};

export type PricingLookupCacheInput = {
  cacheKey: string;
  provider: string;
  model: string;
  matchedSource: PricingLookupMatchedSource;
  matchedKey?: string | null;
  confidence: PricingLookupConfidence;
  inputPricePerMillion?: number | null;
  outputPricePerMillion?: number | null;
  cachedInputPricePerMillion?: number | null;
  fetchedAt: string;
  updatedAt: string;
  noMatch?: boolean;
};

type PricingModelRow = {
  id: string;
  provider: string;
  model: string;
  input_price_per_million: number;
  output_price_per_million: number;
  cached_input_price_per_million: number | null;
  effective_from: string | null;
  metadata_json: string | null;
};

type PricingLookupCacheRow = {
  cache_key: string;
  provider: string;
  model: string;
  matched_source: string;
  matched_key: string | null;
  confidence: string;
  input_price_per_million: number | null;
  output_price_per_million: number | null;
  cached_input_price_per_million: number | null;
  fetched_at: string;
  updated_at: string;
  no_match: number;
};

const MAX_LOOKUP_CACHE_ENTRIES = 512;

const ALLOWED_INPUT_KEYS = new Set([
  'provider',
  'model',
  'inputPricePerMillion',
  'outputPricePerMillion',
  'cachedInputPricePerMillion',
  'currency',
  'active',
  'enabled',
  'effectiveFrom'
]);

export class PricingModelsRepository {
  constructor(private readonly db: TokenWatchDb) {}

  createOrUpdateCustom(input: CustomPricingModelInput): CustomPricingModel {
    const model = normalizeCustomPricingInput(input);
    this.upsert(model, toMetadata(model));
    return model;
  }

  replaceExternalCache(
    source: ExternalPricingSource,
    inputs: readonly ExternalPricingModelInput[],
    fetchedAt: string
  ): ExternalPricingModel[] {
    const normalizedFetchedAt = normalizeFetchedAt(fetchedAt);
    const models = inputs.map((input) =>
      normalizeExternalPricingInput(source, input, normalizedFetchedAt)
    );
    const replace = this.db.transaction((rows: ExternalPricingModel[]) => {
      this.db.prepare('DELETE FROM pricing_models WHERE id LIKE ?').run(`${source}:%`);
      for (const model of rows) {
        this.upsert(model, toMetadata(model));
      }
    });
    replace(models);
    return models;
  }

  getById(id: string): CustomPricingModel | ExternalPricingModel | null {
    const row = this.db.prepare('SELECT * FROM pricing_models WHERE id = ?').get(id) as
      | PricingModelRow
      | undefined;
    return row ? mapAnyRow(row) : null;
  }

  getCustom(provider: string, model: string): CustomPricingModel | null {
    const normalized = normalizePricingIdentity(provider, model);
    const row = this.db
      .prepare(
        "SELECT * FROM pricing_models WHERE id LIKE 'custom:%' AND provider = ? AND model = ?"
      )
      .get(normalized.provider, normalized.model) as PricingModelRow | undefined;
    return row ? mapCustomRow(row) : null;
  }

  listCustom(): CustomPricingModel[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM pricing_models WHERE id LIKE 'custom:%' ORDER BY provider ASC, model ASC"
      )
      .all() as PricingModelRow[];
    return rows.map(mapCustomRow);
  }

  getExternal(
    source: ExternalPricingSource,
    provider: string,
    model: string
  ): ExternalPricingModel | null {
    const normalized = normalizePricingIdentity(provider, model);
    const row = this.db
      .prepare('SELECT * FROM pricing_models WHERE id LIKE ? AND provider = ? AND model = ?')
      .get(`${source}:%`, normalized.provider, normalized.model) as PricingModelRow | undefined;
    return row ? mapExternalRow(row, source) : null;
  }

  getExternalAlias(
    source: ExternalPricingSource,
    provider: string,
    model: string
  ): ExternalPricingModel | null {
    const requested = normalizePricingIdentity(provider, model);
    const exactRequested = normalizeExactPricingIdentity(provider, model);
    const rows = this.db
      .prepare('SELECT * FROM pricing_models WHERE id LIKE ?')
      .all(`${source}:%`) as PricingModelRow[];
    const usableRows = rows.map((row) => mapExternalRow(row, source)).filter(isActiveAndEnabled);
    const exactMatches = usableRows.filter((row) =>
      externalAliasCandidates(source, row).some(
        (candidate) =>
          candidate.provider === exactRequested.provider && candidate.model === exactRequested.model
      )
    );
    const matches =
      exactMatches.length > 0
        ? exactMatches
        : usableRows.filter((row) =>
            externalAliasCandidates(source, row).some((candidate) => {
              const normalized = normalizePricingIdentity(candidate.provider, candidate.model);
              return (
                normalized.provider === requested.provider && normalized.model === requested.model
              );
            })
          );

    if (matches.length !== 1) return null;
    return matches[0] ?? null;
  }

  findExternalFuzzy(
    source: ExternalPricingSource,
    provider: string,
    model: string
  ): ExternalPricingModel | null {
    const normalized = normalizePricingIdentity(provider, model);
    if (!isSafeFuzzyRequestedModel(normalized.model)) return null;

    const rows = this.db
      .prepare('SELECT * FROM pricing_models WHERE id LIKE ? AND provider = ?')
      .all(`${source}:%`, normalized.provider) as PricingModelRow[];
    const candidates = fuzzyLookupCandidates(normalized.model);
    for (const candidate of candidates) {
      const matches = rows
        .map((row) => mapExternalRow(row, source))
        .filter(isActiveAndEnabled)
        .filter((row) => isSafeFuzzyCandidate(row.model, candidate));

      if (matches.length === 1) return matches[0] ?? null;
      if (matches.length > 1) return null;
    }

    return null;
  }

  getLookupCache(cacheKey: string): PricingLookupCacheEntry | null {
    const safeCacheKey = normalizeCacheKey(cacheKey);
    const row = this.db
      .prepare('SELECT * FROM pricing_lookup_cache WHERE cache_key = ?')
      .get(safeCacheKey) as PricingLookupCacheRow | undefined;
    return row ? mapLookupCacheRow(row) : null;
  }

  setLookupCache(input: PricingLookupCacheInput): PricingLookupCacheEntry {
    const entry = normalizeLookupCacheInput(input);
    const write = this.db.transaction((normalized: PricingLookupCacheEntry) => {
      this.db
        .prepare(
          `INSERT INTO pricing_lookup_cache (
            cache_key, provider, model, matched_source, matched_key, confidence,
            input_price_per_million, output_price_per_million, cached_input_price_per_million,
            fetched_at, updated_at, no_match
          ) VALUES (
            @cacheKey, @provider, @model, @matchedSource, @matchedKey, @confidence,
            @inputPricePerMillion, @outputPricePerMillion, @cachedInputPricePerMillion,
            @fetchedAt, @updatedAt, @noMatch
          ) ON CONFLICT(cache_key) DO UPDATE SET
            provider = excluded.provider,
            model = excluded.model,
            matched_source = excluded.matched_source,
            matched_key = excluded.matched_key,
            confidence = excluded.confidence,
            input_price_per_million = excluded.input_price_per_million,
            output_price_per_million = excluded.output_price_per_million,
            cached_input_price_per_million = excluded.cached_input_price_per_million,
            fetched_at = excluded.fetched_at,
            updated_at = excluded.updated_at,
            no_match = excluded.no_match`
        )
        .run({ ...normalized, noMatch: normalized.noMatch ? 1 : 0 });
      this.evictLookupCache();
    });
    write(entry);
    return entry;
  }

  importLookupCache(inputs: readonly PricingLookupCacheInput[]): number {
    let imported = 0;
    const write = this.db.transaction((entries: readonly PricingLookupCacheInput[]) => {
      for (const input of entries) {
        const entry = normalizeLookupCacheInput(input);
        this.db
          .prepare(
            `INSERT INTO pricing_lookup_cache (
              cache_key, provider, model, matched_source, matched_key, confidence,
              input_price_per_million, output_price_per_million, cached_input_price_per_million,
              fetched_at, updated_at, no_match
            ) VALUES (
              @cacheKey, @provider, @model, @matchedSource, @matchedKey, @confidence,
              @inputPricePerMillion, @outputPricePerMillion, @cachedInputPricePerMillion,
              @fetchedAt, @updatedAt, @noMatch
            ) ON CONFLICT(cache_key) DO UPDATE SET
              provider = excluded.provider,
              model = excluded.model,
              matched_source = excluded.matched_source,
              matched_key = excluded.matched_key,
              confidence = excluded.confidence,
              input_price_per_million = excluded.input_price_per_million,
              output_price_per_million = excluded.output_price_per_million,
              cached_input_price_per_million = excluded.cached_input_price_per_million,
              fetched_at = excluded.fetched_at,
              updated_at = excluded.updated_at,
              no_match = excluded.no_match`
          )
          .run({ ...entry, noMatch: entry.noMatch ? 1 : 0 });
        imported += 1;
      }
      this.evictLookupCache();
    });
    write(inputs);
    return imported;
  }

  listLookupCache(): PricingLookupCacheEntry[] {
    const rows = this.db
      .prepare('SELECT * FROM pricing_lookup_cache ORDER BY provider ASC, model ASC, cache_key ASC')
      .all() as PricingLookupCacheRow[];
    return rows.map(mapLookupCacheRow);
  }

  evictLookupCache(maxEntries = MAX_LOOKUP_CACHE_ENTRIES): number {
    if (!Number.isInteger(maxEntries) || maxEntries < 0) throw new Error('validation_failed');
    const count = this.db.prepare('SELECT COUNT(*) AS count FROM pricing_lookup_cache').get() as {
      count: number;
    };
    const excess = count.count - maxEntries;
    if (excess <= 0) return 0;
    const result = this.db
      .prepare(
        `DELETE FROM pricing_lookup_cache
         WHERE cache_key IN (
           SELECT cache_key FROM pricing_lookup_cache
           ORDER BY updated_at ASC, cache_key ASC
           LIMIT ?
         )`
      )
      .run(excess);
    return result.changes;
  }

  listExternal(source?: ExternalPricingSource): ExternalPricingModel[] {
    const rows = source
      ? (this.db
          .prepare('SELECT * FROM pricing_models WHERE id LIKE ? ORDER BY provider ASC, model ASC')
          .all(`${source}:%`) as PricingModelRow[])
      : (this.db
          .prepare(
            "SELECT * FROM pricing_models WHERE id LIKE 'litellm:%' OR id LIKE 'openrouter:%' ORDER BY provider ASC, model ASC"
          )
          .all() as PricingModelRow[]);
    return rows.map((row) => mapExternalRow(row, source));
  }

  private upsert(
    model: CustomPricingModel | ExternalPricingModel,
    metadata: Record<string, unknown>
  ): void {
    this.db
      .prepare(
        `INSERT INTO pricing_models (
          id, provider, model, input_price_per_million, output_price_per_million,
          cached_input_price_per_million, effective_from, metadata_json
        ) VALUES (
          @id, @provider, @model, @inputPricePerMillion, @outputPricePerMillion,
          @cachedInputPricePerMillion, @effectiveFrom, @metadataJson
        ) ON CONFLICT(id) DO UPDATE SET
          provider = excluded.provider,
          model = excluded.model,
          input_price_per_million = excluded.input_price_per_million,
          output_price_per_million = excluded.output_price_per_million,
          cached_input_price_per_million = excluded.cached_input_price_per_million,
          effective_from = excluded.effective_from,
          metadata_json = excluded.metadata_json`
      )
      .run({
        id: model.id,
        provider: model.provider,
        model: model.model,
        inputPricePerMillion: model.inputPricePerMillion,
        outputPricePerMillion: model.outputPricePerMillion,
        cachedInputPricePerMillion: model.cachedInputPricePerMillion,
        effectiveFrom: 'fetchedAt' in model ? model.fetchedAt : model.effectiveFrom,
        metadataJson: JSON.stringify(metadata)
      });
  }
}

function normalizeCustomPricingInput(input: CustomPricingModelInput): CustomPricingModel {
  rejectUnknownInputKeys(input);
  const normalized = normalizePricingIdentity(input.provider, input.model);
  const currency = normalizeCurrency(input.currency ?? 'USD');
  const active = input.active ?? true;
  const enabled = input.enabled ?? true;

  if (typeof active !== 'boolean' || typeof enabled !== 'boolean') {
    throw new Error('validation_failed');
  }

  return {
    id: pricingId('custom', normalized.provider, normalized.model),
    provider: normalized.provider,
    model: normalized.model,
    inputPricePerMillion: validateRequiredPrice(input.inputPricePerMillion),
    outputPricePerMillion: validateRequiredPrice(input.outputPricePerMillion),
    cachedInputPricePerMillion:
      input.cachedInputPricePerMillion === undefined || input.cachedInputPricePerMillion === null
        ? null
        : validatePrice(input.cachedInputPricePerMillion),
    currency,
    source: 'custom',
    active,
    enabled,
    effectiveFrom: normalizeEffectiveFrom(input.effectiveFrom ?? null)
  };
}

function normalizeExternalPricingInput(
  source: ExternalPricingSource,
  input: ExternalPricingModelInput,
  fetchedAt: string
): ExternalPricingModel {
  const normalized = normalizePricingIdentity(input.provider, input.model);
  const active = input.active ?? true;
  const enabled = input.enabled ?? true;

  if (typeof active !== 'boolean' || typeof enabled !== 'boolean') {
    throw new Error('validation_failed');
  }

  return {
    id: pricingId(source, normalized.provider, normalized.model),
    provider: normalized.provider,
    model: normalized.model,
    inputPricePerMillion: validateRequiredPrice(input.inputPricePerMillion),
    outputPricePerMillion: validateRequiredPrice(input.outputPricePerMillion),
    cachedInputPricePerMillion:
      input.cachedInputPricePerMillion === undefined || input.cachedInputPricePerMillion === null
        ? null
        : validatePrice(input.cachedInputPricePerMillion),
    currency: 'USD',
    source,
    active,
    enabled,
    fetchedAt
  };
}

function normalizePricingIdentity(
  provider: string,
  model: string
): { provider: string; model: string } {
  if (typeof provider !== 'string' || typeof model !== 'string') {
    throw new Error('validation_failed');
  }
  const safeProvider = validateCanonicalField('provider', provider);
  const safeModel = validateCanonicalField('model', model);
  const normalized = normalizePricingModel(safeProvider, safeModel);
  return {
    provider: validateCanonicalField('provider', normalized.provider),
    model: validateCanonicalField('model', normalized.model)
  };
}

function normalizeExactPricingIdentity(
  provider: string,
  model: string
): { provider: string; model: string } {
  if (typeof provider !== 'string' || typeof model !== 'string') {
    throw new Error('validation_failed');
  }
  return {
    provider: validateCanonicalField('provider', provider.trim().toLowerCase()),
    model: validateCanonicalField('model', model.trim().toLowerCase())
  };
}

function isActiveAndEnabled(model: ExternalPricingModel): boolean {
  return model.active && model.enabled;
}

function externalAliasCandidates(
  source: ExternalPricingSource,
  model: ExternalPricingModel
): Array<{ provider: string; model: string }> {
  const aliases = [
    { provider: source, model: model.model },
    { provider: source, model: `${model.provider}/${model.model}` },
    { provider: model.provider, model: `${model.provider}/${model.model}` },
    { provider: model.provider, model: `${source}/${model.model}` }
  ];
  return Array.from(
    new Map(
      aliases.map((alias) => {
        const exactAlias = normalizeExactPricingIdentity(alias.provider, alias.model);
        return [`${exactAlias.provider}\0${exactAlias.model}`, exactAlias];
      })
    ).values()
  );
}

const FUZZY_BLOCKLIST = new Set(['auto', 'base', 'chat', 'mini']);
const MIN_FUZZY_MATCH_LEN = 5;
const MIN_MODEL_NAME_LEN = 2;
const MAX_PREFIX_STRIP_SEGMENTS = 2;
const MAX_SUFFIX_STRIP_SEGMENTS = 4;

function isSafeFuzzyRequestedModel(model: string): boolean {
  return isFuzzyEligible(model) && !/^[a-z0-9]{1,3}$/u.test(model);
}

function fuzzyLookupCandidates(model: string): string[] {
  const candidates: string[] = [];
  pushFuzzyCandidate(candidates, model);
  for (const candidate of suffixStrippedCandidates(model)) {
    pushFuzzyCandidate(candidates, candidate);
  }
  for (const prefixCandidate of prefixStrippedCandidates(model)) {
    pushFuzzyCandidate(candidates, prefixCandidate);
    for (const suffixCandidate of suffixStrippedCandidates(prefixCandidate)) {
      pushFuzzyCandidate(candidates, suffixCandidate);
    }
  }
  return candidates;
}

function prefixStrippedCandidates(model: string): string[] {
  const parts = model.split('-');
  const maxSkip = Math.min(parts.length - 1, MAX_PREFIX_STRIP_SEGMENTS);
  const candidates: string[] = [];
  for (let skip = 1; skip <= maxSkip; skip += 1) {
    candidates.push(parts.slice(skip).join('-'));
  }
  return candidates;
}

function suffixStrippedCandidates(model: string): string[] {
  const parts = model.split('-');
  const maxStrip = Math.min(parts.length - 1, MAX_SUFFIX_STRIP_SEGMENTS);
  const candidates: string[] = [];
  for (let strip = 1; strip <= maxStrip; strip += 1) {
    candidates.push(parts.slice(0, parts.length - strip).join('-'));
  }
  return candidates;
}

function pushFuzzyCandidate(candidates: string[], candidate: string): void {
  if (candidate.length < MIN_MODEL_NAME_LEN || !isFuzzyEligible(candidate)) return;
  if (!candidates.includes(candidate)) candidates.push(candidate);
}

function isFuzzyEligible(model: string): boolean {
  return model.length >= MIN_FUZZY_MATCH_LEN && !FUZZY_BLOCKLIST.has(model);
}

function isSafeFuzzyCandidate(candidate: string, requested: string): boolean {
  if (!isFuzzyEligible(candidate) || !isFuzzyEligible(requested)) return false;
  if (candidate === requested) return true;
  if (requested.length <= candidate.length) return false;
  const index = requested.indexOf(candidate);
  if (index < 0) return false;

  const before = index === 0 ? undefined : requested.at(index - 1);
  const after = requested.at(index + candidate.length);
  return isDelimiter(before) && isDelimiter(after);
}

function isDelimiter(value: string | undefined): boolean {
  return value === undefined || !/[a-z0-9]/u.test(value);
}

function validatePrice(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error('validation_failed');
  }
  return value;
}

function normalizeCurrency(value: string): 'USD' {
  if (typeof value !== 'string' || value.trim().toUpperCase() !== 'USD') {
    throw new Error('validation_failed');
  }
  return 'USD';
}

function normalizeEffectiveFrom(value: string | null): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') throw new Error('validation_failed');
  const trimmed = value.trim();
  if (!trimmed || Number.isNaN(Date.parse(trimmed))) throw new Error('validation_failed');
  return trimmed;
}

function normalizeFetchedAt(value: string): string {
  if (typeof value !== 'string') throw new Error('validation_failed');
  const trimmed = value.trim();
  if (!trimmed || Number.isNaN(Date.parse(trimmed))) throw new Error('validation_failed');
  return trimmed;
}

function rejectUnknownInputKeys(input: CustomPricingModelInput): void {
  for (const key of Object.keys(input)) {
    if (!ALLOWED_INPUT_KEYS.has(key)) {
      throw new Error('validation_failed');
    }
  }
}

function pricingId(source: PricingSource, provider: string, model: string): string {
  const digest = createHash('sha256').update(`${provider} ${model}`).digest('hex').slice(0, 24);
  return `${source}:${digest}`;
}

function toMetadata(model: CustomPricingModel | ExternalPricingModel): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    source: model.source,
    currency: model.currency,
    active: model.active,
    enabled: model.enabled
  };
  if ('fetchedAt' in model) metadata.fetchedAt = model.fetchedAt;
  return metadata;
}

function mapAnyRow(row: PricingModelRow): CustomPricingModel | ExternalPricingModel {
  const metadata = parseMetadata(row.metadata_json);
  if (metadata.source === 'custom') return mapCustomRow(row);
  return mapExternalRow(row, metadata.source);
}

function mapCustomRow(row: PricingModelRow): CustomPricingModel {
  const metadata = parseMetadata(row.metadata_json);
  if (metadata.source !== 'custom') throw new Error('validation_failed');
  return {
    id: row.id,
    provider: row.provider,
    model: row.model,
    inputPricePerMillion: row.input_price_per_million,
    outputPricePerMillion: row.output_price_per_million,
    cachedInputPricePerMillion: row.cached_input_price_per_million,
    currency: 'USD',
    source: 'custom',
    active: metadata.active,
    enabled: metadata.enabled,
    effectiveFrom: row.effective_from
  };
}

function mapExternalRow(
  row: PricingModelRow,
  expectedSource?: ExternalPricingSource
): ExternalPricingModel {
  const metadata = parseMetadata(row.metadata_json);
  if (metadata.source === 'custom') throw new Error('validation_failed');
  if (expectedSource && metadata.source !== expectedSource) throw new Error('validation_failed');
  return {
    id: row.id,
    provider: row.provider,
    model: row.model,
    inputPricePerMillion: row.input_price_per_million,
    outputPricePerMillion: row.output_price_per_million,
    cachedInputPricePerMillion: row.cached_input_price_per_million,
    currency: 'USD',
    source: metadata.source,
    active: metadata.active,
    enabled: metadata.enabled,
    fetchedAt: metadata.fetchedAt ?? row.effective_from ?? ''
  };
}

function parseMetadata(value: string | null): {
  source: PricingSource;
  active: boolean;
  enabled: boolean;
  fetchedAt?: string;
} {
  if (!value) return { source: 'custom', active: true, enabled: true };
  const parsed = JSON.parse(value) as {
    source?: unknown;
    active?: unknown;
    enabled?: unknown;
    fetchedAt?: unknown;
  };
  const source = parseSource(parsed.source);
  const fetchedAt =
    typeof parsed.fetchedAt === 'string' && !Number.isNaN(Date.parse(parsed.fetchedAt))
      ? parsed.fetchedAt
      : undefined;
  return {
    source,
    active: parsed.active === undefined ? true : parsed.active === true,
    enabled: parsed.enabled === undefined ? true : parsed.enabled === true,
    ...(fetchedAt ? { fetchedAt } : {})
  };
}

function parseSource(value: unknown): PricingSource {
  if (value === 'custom' || value === 'litellm' || value === 'openrouter') return value;
  throw new Error('validation_failed');
}

function normalizeLookupCacheInput(input: PricingLookupCacheInput): PricingLookupCacheEntry {
  if (!isPlainRecord(input)) throw new Error('validation_failed');
  rejectUnknownLookupCacheKeys(input);
  const normalized = normalizePricingIdentity(input.provider, input.model);
  const noMatch = input.noMatch ?? input.matchedSource === 'unknown';
  if (typeof noMatch !== 'boolean') throw new Error('validation_failed');
  const matchedSource = normalizeMatchedSource(input.matchedSource);
  const confidence = normalizeConfidence(input.confidence);
  const matchedKey =
    input.matchedKey === undefined ? null : normalizeNullableCacheField(input.matchedKey);
  const fetchedAt = normalizeFetchedAt(input.fetchedAt);
  const updatedAt = normalizeFetchedAt(input.updatedAt);

  if (noMatch) {
    if (matchedSource !== 'unknown' || confidence !== 'none' || matchedKey !== null) {
      throw new Error('validation_failed');
    }
    return {
      cacheKey: normalizeCacheKey(input.cacheKey),
      provider: normalized.provider,
      model: normalized.model,
      matchedSource,
      matchedKey: null,
      confidence,
      inputPricePerMillion: null,
      outputPricePerMillion: null,
      cachedInputPricePerMillion: null,
      fetchedAt,
      updatedAt,
      noMatch: true
    };
  }

  if (matchedSource === 'unknown' || confidence === 'none' || matchedKey === null) {
    throw new Error('validation_failed');
  }

  return {
    cacheKey: normalizeCacheKey(input.cacheKey),
    provider: normalized.provider,
    model: normalized.model,
    matchedSource,
    matchedKey,
    confidence,
    inputPricePerMillion: validateRequiredPrice(input.inputPricePerMillion),
    outputPricePerMillion: validateRequiredPrice(input.outputPricePerMillion),
    cachedInputPricePerMillion:
      input.cachedInputPricePerMillion === undefined || input.cachedInputPricePerMillion === null
        ? null
        : validatePrice(input.cachedInputPricePerMillion),
    fetchedAt,
    updatedAt,
    noMatch: false
  };
}

function validateRequiredPrice(value: number | null | undefined): number {
  if (value === undefined || value === null) throw new Error('validation_failed');
  return validatePrice(value);
}

function normalizeCacheKey(value: string): string {
  if (typeof value !== 'string') throw new Error('validation_failed');
  const trimmed = value.trim().toLowerCase();
  if (
    trimmed.length < 1 ||
    trimmed.length > 160 ||
    !/^[a-z0-9][a-z0-9_.:-]*$/.test(trimmed) ||
    containsUnsafePrivacyShape(trimmed)
  ) {
    throw new Error('validation_failed');
  }
  return trimmed;
}

function normalizeNullableCacheField(value: string | null): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') throw new Error('validation_failed');
  const trimmed = value.trim().toLowerCase();
  if (
    trimmed.length < 1 ||
    trimmed.length > 160 ||
    !/^[a-z0-9][a-z0-9_.:/@+ -]*[a-z0-9]$|^[a-z0-9]$/.test(trimmed) ||
    containsUnsafePrivacyShape(trimmed)
  ) {
    throw new Error('validation_failed');
  }
  return trimmed;
}

function normalizeMatchedSource(value: PricingLookupMatchedSource): PricingLookupMatchedSource {
  if (
    value === 'custom' ||
    value === 'litellm' ||
    value === 'openrouter' ||
    value === 'bundled' ||
    value === 'cursor' ||
    value === 'unknown'
  ) {
    return value;
  }
  throw new Error('validation_failed');
}

function normalizeConfidence(value: PricingLookupConfidence): PricingLookupConfidence {
  if (
    value === 'exact' ||
    value === 'alias' ||
    value === 'provider-prefix' ||
    value === 'cursor-override' ||
    value === 'fuzzy' ||
    value === 'none'
  ) {
    return value;
  }
  throw new Error('validation_failed');
}

function rejectUnknownLookupCacheKeys(input: PricingLookupCacheInput): void {
  const allowed = new Set([
    'cacheKey',
    'provider',
    'model',
    'matchedSource',
    'matchedKey',
    'confidence',
    'inputPricePerMillion',
    'outputPricePerMillion',
    'cachedInputPricePerMillion',
    'fetchedAt',
    'updatedAt',
    'noMatch'
  ]);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) throw new Error('validation_failed');
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mapLookupCacheRow(row: PricingLookupCacheRow): PricingLookupCacheEntry {
  return {
    cacheKey: row.cache_key,
    provider: row.provider,
    model: row.model,
    matchedSource: normalizeMatchedSource(row.matched_source as PricingLookupMatchedSource),
    matchedKey: row.matched_key,
    confidence: normalizeConfidence(row.confidence as PricingLookupConfidence),
    inputPricePerMillion: row.input_price_per_million,
    outputPricePerMillion: row.output_price_per_million,
    cachedInputPricePerMillion: row.cached_input_price_per_million,
    fetchedAt: row.fetched_at,
    updatedAt: row.updated_at,
    noMatch: row.no_match === 1
  };
}
