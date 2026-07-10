import { ZodError } from 'zod';

import type { DesktopIpcError } from './contracts.js';

const SAFE_IPC_MESSAGES: Record<DesktopIpcError['code'], string> = {
  validation_failed: 'error: validation_failed',
  desktop_dashboard_unavailable: 'error: desktop_dashboard_unavailable',
  desktop_ipc_failed: 'error: desktop_ipc_failed'
};

export class TokenWatchDesktopIpcError extends Error {
  readonly code: DesktopIpcError['code'];

  constructor(error: DesktopIpcError) {
    super(error.message);
    this.name = 'TokenWatchDesktopIpcError';
    this.code = error.code;
    this.stack = undefined;
  }
}

export const sanitizeDesktopIpcError = (error: unknown): DesktopIpcError => {
  if (error instanceof TokenWatchDesktopIpcError) {
    return { code: error.code, message: SAFE_IPC_MESSAGES[error.code] };
  }
  if (error instanceof ZodError) {
    return { code: 'validation_failed', message: SAFE_IPC_MESSAGES.validation_failed };
  }
  return { code: 'desktop_ipc_failed', message: SAFE_IPC_MESSAGES.desktop_ipc_failed };
};

export const toDesktopIpcError = (error: unknown): TokenWatchDesktopIpcError =>
  new TokenWatchDesktopIpcError(sanitizeDesktopIpcError(error));
