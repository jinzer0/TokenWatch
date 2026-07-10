import { TokenWatchError } from './errors.js';
import { PrivacyValidationError, type ScanErrorCode } from '../privacy.js';

type SanitizedCliError = {
  code: ScanErrorCode;
  message: string;
  exitCode: number;
};

const SAFE_MESSAGES: Record<ScanErrorCode, string> = {
  invalid_source_name: 'error: invalid_source_name',
  invalid_project_label: 'error: invalid_project_label',
  invalid_canonical_field: 'error: invalid_canonical_field',
  scan_failed: 'error: scan_failed',
  parser_failed: 'error: parser_failed',
  import_failed: 'error: import_failed',
  invalid_import_file: 'error: invalid_import_file',
  native_sqlite_unavailable: 'error: native_sqlite_unavailable',
  db_open_failed: 'error: db_open_failed',
  migration_failed: 'error: migration_failed',
  config_invalid: 'error: config_invalid',
  unsupported_source: 'error: unsupported_source',
  unsupported_group_by: 'error: unsupported_group_by',
  invalid_report_option: 'error: invalid_report_option',
  invalid_output_path: 'error: invalid_output_path',
  invalid_wrapped_year: 'error: invalid_wrapped_year',
  invalid_statusline_window: 'error: invalid_statusline_window',
  invalid_provider: 'error: invalid_provider',
  headless_payload_rejected: 'error: headless_payload_rejected',
  unsupported_config_key: 'error: unsupported_config_key',
  stale_running_interrupted: 'error: stale_running_interrupted',
  tui_failed: 'error: tui_failed',
  validation_failed: 'error: validation_failed',
  unknown_error: 'error: command_failed'
};

export function sanitizeCliError(error: unknown): SanitizedCliError {
  if (error instanceof TokenWatchError) {
    return { code: error.code, message: SAFE_MESSAGES[error.code], exitCode: error.exitCode };
  }
  if (error instanceof PrivacyValidationError) {
    return { code: error.code, message: SAFE_MESSAGES[error.code], exitCode: 1 };
  }
  if (isCommanderHelpOrVersion(error)) {
    return { code: 'unknown_error', message: '', exitCode: 0 };
  }
  if (isCommanderError(error)) {
    return { code: 'validation_failed', message: SAFE_MESSAGES.validation_failed, exitCode: 1 };
  }
  if (error instanceof SyntaxError) {
    return { code: 'invalid_import_file', message: SAFE_MESSAGES.invalid_import_file, exitCode: 1 };
  }
  if (error instanceof Error && error.name === 'ZodError') {
    return { code: 'validation_failed', message: SAFE_MESSAGES.validation_failed, exitCode: 1 };
  }
  if (error instanceof Error && error.message === 'validation_failed') {
    return { code: 'validation_failed', message: SAFE_MESSAGES.validation_failed, exitCode: 1 };
  }
  return { code: 'unknown_error', message: SAFE_MESSAGES.unknown_error, exitCode: 1 };
}

function isCommanderError(error: unknown): error is { code?: string; exitCode?: number } {
  return error !== null && typeof error === 'object' && 'code' in error && 'exitCode' in error;
}

function isCommanderHelpOrVersion(error: unknown): boolean {
  if (!isCommanderError(error)) return false;
  return (
    error.exitCode === 0 &&
    (error.code === 'commander.helpDisplayed' || error.code === 'commander.version')
  );
}
