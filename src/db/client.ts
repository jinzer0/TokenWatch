import Database from 'better-sqlite3';
import { ensureDbParent, resolveDbPath } from '../app/paths.js';
import { runMigrations } from './migrations.js';

export type TokenWatchDb = Database.Database;

export function openDatabase(dbPath = resolveDbPath()): TokenWatchDb {
  ensureDbParent(dbPath);
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}

export function openReadonlyDatabase(dbPath: string): TokenWatchDb {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  db.pragma('busy_timeout = 5000');
  return db;
}
