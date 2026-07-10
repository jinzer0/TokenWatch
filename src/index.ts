export { createServices } from './services/container.js';
export { openDatabase } from './db/client.js';
export type { TokenWatchDb } from './db/client.js';
export { InsightsService } from './services/insightsService.js';
export { ShareReportService, renderShareReportMarkdown } from './services/shareReport.js';
export {
  StatuslineService,
  renderStatuslinePresetText,
  renderStatuslineText
} from './services/statusline.js';
export { statuslinePresetSchema, statuslineSchema } from './services/statuslineContract.js';
export { TrendService } from './services/trendService.js';
export type { UsageEvent } from './models/usageEvent.js';
export {
  insightsReportOptionsSchema,
  insightsReportSchema,
  trendReportOptionsSchema,
  trendReportSchema
} from './services/reportContracts.js';
export type {
  InsightsReport,
  InsightsReportOptions,
  TrendReport,
  TrendReportOptions
} from './services/reportContracts.js';
export type {
  ShareReportBuildOptions,
  ShareReportFormat,
  ShareReportOptions,
  ShareReportResult,
  ShareReportStatus
} from './services/shareReport.js';
export type {
  BuildStatuslineOptions,
  StatuslineDto,
  StatuslineMetricPreset,
  StatuslinePresetDto,
  StatuslineWindow
} from './services/statusline.js';
export type { BuildTrendReportOptions } from './services/trendService.js';
