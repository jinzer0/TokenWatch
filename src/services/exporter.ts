import { writeFileSync } from 'node:fs';
import { APP_NAME, APP_VERSION, EXPORT_SCHEMA_VERSION, PRICING_VERSION } from '../app/constants.js';
import { nowIso } from '../utils/time.js';
import type { ExportFile } from '../models/exportFile.js';
import type { PricingLookupCacheEntry } from '../db/repositories/pricingModels.js';
import type { UsageEvent } from '../models/usageEvent.js';

export class ExporterService {
  createExport(
    events: UsageEvent[],
    pricingLookupCache: PricingLookupCacheEntry[] = []
  ): ExportFile {
    const sorted = [...events].sort(
      (a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id)
    );
    const sortedCache = [...pricingLookupCache].sort((a, b) =>
      a.cacheKey.localeCompare(b.cacheKey)
    );
    return {
      app: APP_NAME,
      version: APP_VERSION,
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: nowIso(),
      pricingVersion: PRICING_VERSION,
      eventCount: sorted.length,
      events: sorted,
      pricingLookupCache: sortedCache
    };
  }

  write(
    events: UsageEvent[],
    outPath: string,
    pricingLookupCache: PricingLookupCacheEntry[] = []
  ): ExportFile {
    const exportFile = this.createExport(events, pricingLookupCache);
    writeFileSync(outPath, `${JSON.stringify(exportFile, null, 2)}\n`, 'utf8');
    return exportFile;
  }
}
