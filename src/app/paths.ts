import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { DEFAULT_DB_RELATIVE_PATH } from './constants.js';
import { ensureParentDirectory, expandHome } from '../utils/fs.js';

export function resolveDbPath(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.TOKENWATCH_DB_PATH;
  if (override && override.trim().length > 0) {
    return expandHome(override);
  }
  return resolve(homedir(), DEFAULT_DB_RELATIVE_PATH);
}

export function ensureDbParent(dbPath: string): void {
  ensureParentDirectory(dbPath);
}
