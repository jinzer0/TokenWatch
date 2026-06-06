export const SCHEMA_VERSION = 7;

export const schemaSql = `
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pricing_models (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_price_per_million REAL NOT NULL,
  output_price_per_million REAL NOT NULL,
  cached_input_price_per_million REAL,
  effective_from TEXT,
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  source TEXT NOT NULL,
  source_name TEXT NOT NULL,
  agent TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL CHECK (output_tokens >= 0),
  cached_tokens INTEGER NOT NULL DEFAULT 0 CHECK (cached_tokens >= 0),
  cache_write_tokens INTEGER NOT NULL DEFAULT 0 CHECK (cache_write_tokens >= 0),
  reasoning_tokens INTEGER NOT NULL DEFAULT 0 CHECK (reasoning_tokens >= 0),
  total_tokens INTEGER NOT NULL CHECK (total_tokens >= 0),
  estimated_cost_usd REAL,
  session_id_hash TEXT,
  raw_id_hash TEXT,
  raw_source TEXT NOT NULL,
  pricing_version TEXT,
  pricing_source TEXT,
  pricing_confidence TEXT,
  normalized_provider TEXT,
  normalized_model TEXT,
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  message_count INTEGER CHECK (message_count IS NULL OR message_count >= 0),
  workspace_hash TEXT,
  workspace_label TEXT,
  turn_start INTEGER NOT NULL DEFAULT 0 CHECK (turn_start IN (0, 1)),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scan_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  source_name TEXT NOT NULL,
  parser_name TEXT,
  path_kind TEXT NOT NULL DEFAULT 'unknown',
  status TEXT NOT NULL,
  discovered_files INTEGER NOT NULL DEFAULT 0,
  parsed_events INTEGER NOT NULL DEFAULT 0,
  inserted_events INTEGER NOT NULL DEFAULT 0,
  duplicate_events INTEGER NOT NULL DEFAULT 0,
  conflict_events INTEGER NOT NULL DEFAULT 0,
  skipped_records INTEGER NOT NULL DEFAULT 0,
  rejected_records INTEGER NOT NULL DEFAULT 0,
  error_records INTEGER NOT NULL DEFAULT 0,
  warning_codes_json TEXT NOT NULL DEFAULT '[]',
  error_code TEXT
);

CREATE TABLE IF NOT EXISTS budget_thresholds (
  id TEXT PRIMARY KEY,
  scope_kind TEXT NOT NULL CHECK (scope_kind IN ('monthly_total', 'sourceName')),
  source_name TEXT,
  threshold_usd REAL NOT NULL CHECK (threshold_usd > 0),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (scope_kind = 'monthly_total' AND source_name IS NULL) OR
    (scope_kind = 'sourceName' AND source_name IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS pricing_lookup_cache (
  cache_key TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  matched_source TEXT NOT NULL CHECK (matched_source IN ('custom', 'litellm', 'openrouter', 'bundled', 'cursor', 'unknown')),
  matched_key TEXT,
  confidence TEXT NOT NULL CHECK (confidence IN ('exact', 'alias', 'provider-prefix', 'cursor-override', 'fuzzy', 'none')),
  input_price_per_million REAL CHECK (input_price_per_million IS NULL OR input_price_per_million >= 0),
  output_price_per_million REAL CHECK (output_price_per_million IS NULL OR output_price_per_million >= 0),
  cached_input_price_per_million REAL CHECK (cached_input_price_per_million IS NULL OR cached_input_price_per_million >= 0),
  fetched_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  no_match INTEGER NOT NULL CHECK (no_match IN (0, 1)),
  CHECK (
    (no_match = 1 AND matched_key IS NULL AND input_price_per_million IS NULL AND output_price_per_million IS NULL AND cached_input_price_per_million IS NULL) OR
    (no_match = 0 AND matched_key IS NOT NULL AND input_price_per_million IS NOT NULL AND output_price_per_million IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS cursor_pricing_overrides (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  matched_source TEXT NOT NULL CHECK (matched_source IN ('litellm', 'openrouter', 'bundled', 'cursor')),
  matched_key TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('exact', 'alias')),
  input_price_per_million REAL NOT NULL CHECK (input_price_per_million >= 0),
  output_price_per_million REAL NOT NULL CHECK (output_price_per_million >= 0),
  cached_input_price_per_million REAL CHECK (cached_input_price_per_million IS NULL OR cached_input_price_per_million >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_events_timestamp ON usage_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_events_source ON usage_events(source);
CREATE INDEX IF NOT EXISTS idx_usage_events_source_name ON usage_events(source_name);
CREATE INDEX IF NOT EXISTS idx_usage_events_agent ON usage_events(agent);
CREATE INDEX IF NOT EXISTS idx_usage_events_model ON usage_events(provider, model);
CREATE INDEX IF NOT EXISTS idx_usage_events_raw_source ON usage_events(raw_source);
CREATE INDEX IF NOT EXISTS idx_scan_runs_started_at ON scan_runs(started_at);
CREATE INDEX IF NOT EXISTS idx_budget_thresholds_scope ON budget_thresholds(scope_kind, source_name);
CREATE INDEX IF NOT EXISTS idx_pricing_lookup_cache_identity ON pricing_lookup_cache(provider, model);
CREATE INDEX IF NOT EXISTS idx_pricing_lookup_cache_eviction ON pricing_lookup_cache(updated_at, cache_key);
CREATE INDEX IF NOT EXISTS idx_cursor_pricing_overrides_identity ON cursor_pricing_overrides(provider, model);
`;
