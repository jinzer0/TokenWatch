import type { TokenWatchDesktopApi } from '../../shared/api.js';

declare global {
  interface Window {
    tokenwatch: TokenWatchDesktopApi;
  }
}

export {};
