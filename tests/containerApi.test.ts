import { afterEach, describe, expect, it } from 'vitest';
import {
  createServices,
  InsightsService,
  insightsReportSchema,
  openDatabase,
  StatuslineService,
  statuslinePresetSchema,
  TrendService,
  trendReportSchema,
  type TokenWatchDb
} from '../src/index.js';
import { createTempDb } from './helpers.js';

let db: TokenWatchDb | undefined;
let cleanup: (() => void) | undefined;

afterEach(() => {
  db?.close();
  cleanup?.();
  db = undefined;
  cleanup = undefined;
});

describe('public container API', () => {
  it('exposes reusable insights and trend services when creating services', () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);

    const services = createServices(db);

    expect(services.insights).toBeInstanceOf(InsightsService);
    expect(services.trend).toBeInstanceOf(TrendService);
    expect(services.statusline).toBeInstanceOf(StatuslineService);
  });

  it('exports stable report schemas for package consumers', () => {
    expect(insightsReportSchema).toBeDefined();
    expect(trendReportSchema).toBeDefined();
    expect(statuslinePresetSchema).toBeDefined();
  });
});
