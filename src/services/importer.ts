import { readFileSync } from 'node:fs';
import { importFileSchema, importPricingLookupCacheEntrySchema } from '../models/exportFile.js';
import { usageEventSchema, type UsageEvent } from '../models/usageEvent.js';
import { UsageEventsRepository, type InsertEventsResult } from '../db/repositories/usageEvents.js';
import type { PricingModelsRepository } from '../db/repositories/pricingModels.js';

export class ImporterService {
  constructor(
    private readonly usageEventsRepository: UsageEventsRepository,
    private readonly pricingModelsRepository?: PricingModelsRepository
  ) {}

  importFile(filePath: string): InsertEventsResult & { rejected: number } {
    const raw = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
    const parsed = importFileSchema.parse(raw);
    const events: UsageEvent[] = [];
    let rejected = 0;
    for (const event of parsed.events) {
      const result = usageEventSchema.safeParse(event);
      if (result.success) {
        events.push(result.data);
      } else {
        rejected += 1;
      }
    }
    if (this.pricingModelsRepository) {
      for (const entry of parsed.pricingLookupCache) {
        const result = importPricingLookupCacheEntrySchema.safeParse(entry);
        if (!result.success) {
          rejected += 1;
          continue;
        }
        try {
          this.pricingModelsRepository.importLookupCache([result.data]);
        } catch {
          rejected += 1;
        }
      }
    }
    const result = this.usageEventsRepository.insertMany(events);
    return { ...result, rejected };
  }
}
