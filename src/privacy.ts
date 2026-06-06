export type CanonicalFieldName = 'agent' | 'provider' | 'model' | 'rawSource';

export type ScanWarningCode =
  | 'malformed_jsonl_records'
  | 'malformed_json'
  | 'unsupported_json_root'
  | 'unsupported_artifact'
  | 'empty_or_unreadable'
  | 'sqlite_schema_unrecognized'
  | 'sqlite_missing_columns'
  | 'sqlite_unreadable'
  | 'privacy_rejected'
  | 'parser_warning';

export type ScanErrorCode =
  | 'invalid_source_name'
  | 'invalid_canonical_field'
  | 'scan_failed'
  | 'parser_failed'
  | 'import_failed'
  | 'invalid_import_file'
  | 'native_sqlite_unavailable'
  | 'db_open_failed'
  | 'migration_failed'
  | 'config_invalid'
  | 'unsupported_source'
  | 'unsupported_group_by'
  | 'invalid_report_option'
  | 'invalid_output_path'
  | 'invalid_wrapped_year'
  | 'invalid_provider'
  | 'headless_payload_rejected'
  | 'unsupported_config_key'
  | 'stale_running_interrupted'
  | 'tui_failed'
  | 'validation_failed'
  | 'unknown_error';

export type PathKind = 'default' | 'custom' | 'unknown';

export class PrivacyValidationError extends Error {
  constructor(public readonly code: ScanErrorCode) {
    super(code);
    this.name = 'PrivacyValidationError';
  }
}

const PRIVACY_SENTINEL_PATTERN =
  /(PROMPT|RESPONSE|FAKE_API_KEY|FAKE_OAUTH|FAKE_CREDENTIAL|AUTH_CONFIG|RAW_SESSION|RAW_WORKSPACE|RAW_PATH|TOKENWATCH_PATH)_SENTINEL_DO_NOT_LEAK/i;
const SECRET_SHAPE_PATTERN =
  /(api[_-]?key|oauth|credential|secret|password|bearer\s+[A-Za-z0-9._-]+|sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9_]{8,}|xox[baprs]-[A-Za-z0-9-]{8,})/i;
const RAW_CONTENT_PATTERN =
  /(raw[_-]?(record|json|content)|prompt[_-]?sentinel|response[_-]?sentinel|\{\s*"[^"]+"\s*:)/i;
const PATH_SHAPE_PATTERN =
  /(^~([/\\]|$)|^[A-Za-z]:[/\\]|^\/(Users|home|private|var|tmp|etc)(\/|$)|(^|[/\\])(Users|home|private)([/\\]|$)|(^|[/\\])\.?(ssh|aws|config)([/\\]|$)|[/\\][^/\\]*(secret|credential|oauth|token|key|private)[^/\\]*)/i;
const OUTPUT_PATH_SECRET_PATTERN =
  /(api[_-]?key|oauth|credential|secret|password|bearer\s+[A-Za-z0-9._-]+|(^|[^a-z0-9])sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{8,}|xox[baprs]-[A-Za-z0-9-]{8,})/i;

const SOURCE_NAME_PATTERN = /^[A-Za-z0-9_.:-]+$/;
const CANONICAL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/@+ -]*[A-Za-z0-9]$|^[A-Za-z0-9]$/;

export function validateSourceName(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 80 || !SOURCE_NAME_PATTERN.test(trimmed)) {
    throw new PrivacyValidationError('invalid_source_name');
  }
  if (containsUnsafePrivacyShape(trimmed)) {
    throw new PrivacyValidationError('invalid_source_name');
  }
  return trimmed;
}

export function isValidSourceName(value: string): boolean {
  try {
    validateSourceName(value);
    return true;
  } catch {
    return false;
  }
}

export function validateCanonicalField(field: CanonicalFieldName, value: string): string {
  const trimmed = value.trim();
  const max = field === 'model' ? 120 : 80;
  if (trimmed.length < 1 || trimmed.length > max || !CANONICAL_PATTERN.test(trimmed)) {
    throw new PrivacyValidationError('invalid_canonical_field');
  }
  if (containsUnsafePrivacyShape(trimmed)) {
    throw new PrivacyValidationError('invalid_canonical_field');
  }
  return trimmed;
}

export function isValidCanonicalField(field: CanonicalFieldName, value: string): boolean {
  try {
    validateCanonicalField(field, value);
    return true;
  } catch {
    return false;
  }
}

export function containsUnsafePrivacyShape(value: string): boolean {
  return (
    PRIVACY_SENTINEL_PATTERN.test(value) ||
    SECRET_SHAPE_PATTERN.test(value) ||
    RAW_CONTENT_PATTERN.test(value) ||
    PATH_SHAPE_PATTERN.test(value)
  );
}

export function containsUnsafeOutputPathShape(value: string): boolean {
  return (
    PRIVACY_SENTINEL_PATTERN.test(value) ||
    OUTPUT_PATH_SECRET_PATTERN.test(value) ||
    RAW_CONTENT_PATTERN.test(value)
  );
}

export function normalizeWarningCode(value: string): ScanWarningCode {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (normalized.includes('privacy_rejected')) return 'privacy_rejected';
  if (normalized.includes('malformed_jsonl')) return 'malformed_jsonl_records';
  if (normalized.includes('malformed_json')) return 'malformed_json';
  if (normalized.includes('unsupported_json_root')) return 'unsupported_json_root';
  if (normalized.includes('unsupported_artifact') || normalized.includes('unsupported_kind')) {
    return 'unsupported_artifact';
  }
  if (normalized.includes('empty') || normalized.includes('unreadable'))
    return 'empty_or_unreadable';
  if (normalized.includes('sqlite_schema')) return 'sqlite_schema_unrecognized';
  if (normalized.includes('sqlite_missing')) return 'sqlite_missing_columns';
  if (normalized.includes('sqlite')) return 'sqlite_unreadable';
  return 'parser_warning';
}

export function normalizeWarningCodes(values: readonly string[], max = 8): ScanWarningCode[] {
  return Array.from(new Set(values.map(normalizeWarningCode))).slice(0, max);
}

export function safePathKind(hasCustomPath: boolean | undefined): PathKind {
  return hasCustomPath ? 'custom' : 'default';
}
