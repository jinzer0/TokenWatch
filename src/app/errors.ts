import type { ScanErrorCode } from '../privacy.js';

export class TokenWatchError extends Error {
  constructor(
    message: string,
    public readonly exitCode = 1,
    public readonly code: ScanErrorCode = 'unknown_error'
  ) {
    super(message);
    this.name = 'TokenWatchError';
  }
}
