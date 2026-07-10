import type { TokenWatchDb } from '../db/client.js';
import { ConfigRepository } from '../db/repositories/config.js';
import { BudgetThresholdsRepository } from '../db/repositories/budgetThresholds.js';
import { ScanRunsRepository } from '../db/repositories/scanRuns.js';
import { UsageEventsRepository } from '../db/repositories/usageEvents.js';
import { PricingModelsRepository } from '../db/repositories/pricingModels.js';
import { AggregatorService } from './aggregator.js';
import { BudgetService } from './budgetService.js';
import { ConfigService } from './configService.js';
import { DoctorService } from './doctor.js';
import { DesktopDashboardService } from './desktopDashboard.js';
import { ExporterService } from './exporter.js';
import { HeadlessCodexIngestService } from './headlessCodex.js';
import { ImporterService } from './importer.js';
import { InsightsService } from './insightsService.js';
import { ScannerService } from './scanner.js';
import { ShareReportService } from './shareReport.js';
import { StatuslineService } from './statusline.js';
import { TrendService } from './trendService.js';
import { PricingResolver } from '../pricing/pricing.js';

export function createServices(db: TokenWatchDb) {
  const usageEvents = new UsageEventsRepository(db);
  const scanRuns = new ScanRunsRepository(db);
  const pricingModels = new PricingModelsRepository(db);
  const budgetThresholds = new BudgetThresholdsRepository(db);
  const configRepository = new ConfigRepository(db);
  const config = new ConfigService(configRepository);
  const aggregator = new AggregatorService();
  const pricingResolver = new PricingResolver(pricingModels);
  const budget = new BudgetService(budgetThresholds, usageEvents);
  const insights = new InsightsService();
  const trend = new TrendService();
  return {
    usageEvents,
    scanRuns,
    pricingModels,
    budgetThresholds,
    config,
    aggregator,
    exporter: new ExporterService(),
    headlessCodex: new HeadlessCodexIngestService(usageEvents),
    importer: new ImporterService(usageEvents, pricingModels),
    insights,
    budget,
    shareReport: new ShareReportService(),
    statusline: new StatuslineService(),
    trend,
    desktopDashboard: new DesktopDashboardService({
      aggregator,
      budget,
      insights,
      pricingModels,
      scanRuns,
      trend,
      usageEvents
    }),
    scanner: new ScannerService(usageEvents, scanRuns, config, pricingResolver, pricingModels),
    doctor: new DoctorService(config, usageEvents, scanRuns, aggregator)
  };
}
