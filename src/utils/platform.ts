import { platform, release } from 'node:os';
import { APP_VERSION } from '../app/constants.js';

export function getPlatformInfo(): Record<string, string> {
  return {
    os: `${platform()} ${release()}`,
    node: process.version,
    tokenwatch: APP_VERSION
  };
}
