import { mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';

export function expandHome(pathValue: string): string {
  if (pathValue === '~') {
    return homedir();
  }
  if (pathValue.startsWith('~/')) {
    return resolve(homedir(), pathValue.slice(2));
  }
  return resolve(pathValue);
}

export function ensureParentDirectory(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

export function pathExists(pathValue: string): boolean {
  try {
    statSync(pathValue);
    return true;
  } catch {
    return false;
  }
}
