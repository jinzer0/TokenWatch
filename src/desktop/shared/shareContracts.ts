import { z } from 'zod';
import { desktopDashboardFiltersSchema } from './contracts.js';

const shareReportFormats = ['json', 'markdown', 'png'] as const;
const shareReportStatuses = ['written', 'cancelled'] as const;
const graphBuckets = ['hour', 'day', 'month'] as const;
const graphMetrics = ['tokens', 'cost', 'events'] as const;
const reportWindows = ['7d', '30d'] as const;

const graphShareReportSchema = z
  .object({
    kind: z.literal('graph'),
    bucket: z.enum(graphBuckets).optional(),
    metric: z.enum(graphMetrics).optional()
  })
  .strict();

const wrappedShareReportSchema = z
  .object({ kind: z.literal('wrapped'), year: z.number() })
  .strict();

const insightsShareReportSchema = z
  .object({ kind: z.literal('insights'), window: z.enum(reportWindows).optional() })
  .strict();

const trendShareReportSchema = z
  .object({ kind: z.literal('trend'), window: z.enum(reportWindows).optional() })
  .strict();

export const desktopShareReportRequestSchema = z
  .object({
    format: z.enum(shareReportFormats),
    filters: desktopDashboardFiltersSchema.optional(),
    report: z.discriminatedUnion('kind', [
      graphShareReportSchema,
      insightsShareReportSchema,
      trendShareReportSchema,
      wrappedShareReportSchema
    ])
  })
  .strict();

export const desktopShareReportResultSchema = z
  .object({
    format: z.enum(shareReportFormats),
    fileName: z.string().min(1).max(255).nullable(),
    bytesWritten: z.number().int().nonnegative(),
    status: z.enum(shareReportStatuses)
  })
  .strict();

export const desktopShareIpcArgsSchema = z.tuple([desktopShareReportRequestSchema]);

export const desktopShareIpcChannels = {
  shareExportReport: 'share:exportReport'
} as const;

export type DesktopShareReportRequest = z.output<typeof desktopShareReportRequestSchema>;
export type DesktopShareReportRequestInput = z.input<typeof desktopShareReportRequestSchema>;
export type DesktopShareReportResult = z.infer<typeof desktopShareReportResultSchema>;
export type DesktopShareIpcChannel =
  (typeof desktopShareIpcChannels)[keyof typeof desktopShareIpcChannels];
