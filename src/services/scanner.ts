import { randomUUID } from 'node:crypto';
import { DEFAULT_SOURCE_NAME } from '../app/constants.js';
import type { SourceType } from '../models/usageEvent.js';
import {
  finalizeUsageEvent,
  usageEventDraftSchema,
  type UsageEvent,
  type UsageEventDraft
} from '../models/usageEvent.js';
import type { ScanRun } from '../models/scanRun.js';
import { normalizeWarningCodes, safePathKind } from '../privacy.js';
import { UsageEventsRepository } from '../db/repositories/usageEvents.js';
import { ScanRunsRepository } from '../db/repositories/scanRuns.js';
import { getParser, listParsers } from '../parsers/registry.js';
import type { PricingModelsRepository } from '../db/repositories/pricingModels.js';
import {
  ensureExternalPricingCache,
  PRICING_LOOKUP_WARNING,
  type PricingResolver
} from '../pricing/pricing.js';
import { nowIso } from '../utils/time.js';
import { ConfigService } from './configService.js';

export type ScanOptions = {
  source?: SourceType;
  path?: string;
  sourceName?: string;
};

export type ScanResult = {
  discoveredFiles: number;
  parsedEvents: number;
  insertedEvents: number;
  duplicateEvents: number;
  conflictEvents: number;
  skippedRecords: number;
  rejectedRecords: number;
  errorRecords: number;
  warnings: string[];
};

export class ScannerService {
  constructor(
    private readonly usageEventsRepository: UsageEventsRepository,
    private readonly scanRunsRepository: ScanRunsRepository,
    private readonly configService: ConfigService,
    private readonly pricingResolver: PricingResolver,
    private readonly pricingModelsRepository: PricingModelsRepository
  ) {}

  async scan(options: ScanOptions): Promise<ScanResult> {
    const sourceName = options.sourceName
      ? this.configService.resolveSourceName(options.sourceName)
      : this.configService.getSourceName() || DEFAULT_SOURCE_NAME;
    const parsers = options.source ? [getParser(options.source)] : listParsers();
    const result: ScanResult = {
      discoveredFiles: 0,
      parsedEvents: 0,
      insertedEvents: 0,
      duplicateEvents: 0,
      conflictEvents: 0,
      skippedRecords: 0,
      rejectedRecords: 0,
      errorRecords: 0,
      warnings: []
    };
    const pricingLookup = await ensureExternalPricingCache(this.pricingModelsRepository);
    if (pricingLookup.warning) result.warnings.push(PRICING_LOOKUP_WARNING);
    this.scanRunsRepository.markStaleRunningInterrupted(
      new Date(Date.now() - 60 * 60 * 1000).toISOString()
    );

    for (const parser of parsers) {
      const runWarnings: string[] = [];
      const run: ScanRun = {
        id: randomUUID(),
        startedAt: nowIso(),
        finishedAt: null,
        sourceName,
        parserName: parser.name,
        pathKind: safePathKind(Boolean(options.path)),
        status: 'running',
        discoveredFiles: 0,
        parsedEvents: 0,
        insertedEvents: 0,
        duplicateEvents: 0,
        conflictEvents: 0,
        skippedRecords: 0,
        rejectedRecords: 0,
        errorRecords: 0,
        warningCodes: [],
        errorCode: null
      };
      this.scanRunsRepository.create(run);
      try {
        const files = await parser.discover({ path: options.path });
        run.discoveredFiles = files.length;
        result.discoveredFiles += files.length;
        const drafts: UsageEventDraft[] = [];
        for (const file of files) {
          const parsed = await parser.parse(file, { sourceName, now: nowIso() });
          drafts.push(...parsed.events);
          run.skippedRecords += parsed.skippedRecords;
          result.skippedRecords += parsed.skippedRecords;
          runWarnings.push(...parsed.warnings);
          result.warnings.push(...parsed.warnings.map((warning) => `${parser.name}:${warning}`));
        }
        const events: UsageEvent[] = [];
        for (const draft of drafts) {
          try {
            events.push(withPricing(draft, this.pricingResolver));
          } catch {
            run.rejectedRecords += 1;
            result.rejectedRecords += 1;
            runWarnings.push('privacy_rejected');
            result.warnings.push(`${parser.name}:privacy_rejected`);
          }
        }
        this.usageEventsRepository.transaction(() => {
          const insert = this.usageEventsRepository.insertManyInCurrentTransaction(events);
          run.parsedEvents = events.length;
          run.insertedEvents = insert.inserted;
          run.duplicateEvents = insert.duplicates;
          run.conflictEvents = insert.conflicts;
          run.warningCodes = normalizeWarningCodes(runWarnings);
          run.status = 'completed';
          run.finishedAt = nowIso();
          this.scanRunsRepository.update(run);
        });
        result.parsedEvents += run.parsedEvents;
        result.insertedEvents += run.insertedEvents;
        result.duplicateEvents += run.duplicateEvents;
        result.conflictEvents += run.conflictEvents;
      } catch {
        run.status = 'failed';
        run.finishedAt = nowIso();
        run.errorRecords += 1;
        result.errorRecords += 1;
        run.errorCode = 'scan_failed';
        run.warningCodes = normalizeWarningCodes(runWarnings);
        result.warnings.push(`${parser.name}:scan-failed`);
      }
      if (run.status === 'failed') {
        this.scanRunsRepository.update(run);
      }
    }

    return result;
  }
}

function withPricing(draft: UsageEventDraft, pricingResolver: PricingResolver): UsageEvent {
  const normalized = usageEventDraftSchema.parse(draft);
  const pricing = pricingResolver.resolve({
    provider: normalized.provider,
    model: normalized.model,
    inputTokens: normalized.inputTokens,
    outputTokens: normalized.outputTokens,
    cachedTokens: normalized.cachedTokens
  });
  return finalizeUsageEvent({
    ...normalized,
    estimatedCostUsd: pricing.estimatedCostUsd,
    pricingSource: pricing.pricingSource,
    pricingConfidence: pricing.pricingConfidence,
    normalizedProvider: pricing.normalizedProvider,
    normalizedModel: pricing.normalizedModel
  });
}
