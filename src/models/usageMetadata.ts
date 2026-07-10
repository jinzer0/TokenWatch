import { z } from 'zod';
import { containsUnsafePrivacyShape } from '../privacy.js';

const forbiddenMetadataKeyPattern =
  /(prompt|response|content|text|raw|path|auth|token|key|secret|credential)/i;

const allowedMetadataKeys = new Set([
  'parser',
  'parserVersion',
  'schemaVariant',
  'safeCode',
  'provenanceHash',
  'recordOrdinalHash',
  'projectLabelSource'
]);

const explicitProjectLabelSourceValues = ['config', 'scan-option', 'headless-input'] as const;

const metadataValueSchema: z.ZodType<unknown> = z.union([
  z.string().max(256),
  z.number(),
  z.boolean(),
  z.null()
]);

export const safeMetadataSchema = z
  .record(z.string(), metadataValueSchema)
  .default({})
  .superRefine((metadata, ctx) => {
    for (const [key, value] of Object.entries(metadata)) {
      if (!allowedMetadataKeys.has(key)) {
        ctx.addIssue({
          code: 'custom',
          message: `Unsupported metadata key: ${key}`,
          path: [key]
        });
      }
      if (forbiddenMetadataKeyPattern.test(key)) {
        ctx.addIssue({
          code: 'custom',
          message: `Forbidden metadata key: ${key}`,
          path: [key]
        });
      }
      if (containsForbiddenMetadataValue(key, value)) {
        ctx.addIssue({
          code: 'custom',
          message: `Forbidden metadata value for key: ${key}`,
          path: [key]
        });
      }
    }
  });

export function sanitizeMetadata(
  metadata: Record<string, unknown> | undefined
): Record<string, unknown> {
  const candidate = metadata ?? {};
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(candidate)) {
    if (!allowedMetadataKeys.has(key)) {
      continue;
    }
    if (forbiddenMetadataKeyPattern.test(key)) {
      continue;
    }
    if (containsForbiddenMetadataValue(key, value)) {
      continue;
    }
    result[key] = value;
  }
  return safeMetadataSchema.parse(result);
}

function containsForbiddenMetadataValue(key: string, value: unknown): boolean {
  if (
    key === 'projectLabelSource' &&
    explicitProjectLabelSourceValues.some((source) => source === value)
  ) {
    return false;
  }
  if (typeof value === 'string') {
    return containsUnsafePrivacyShape(value);
  }
  if (Array.isArray(value)) {
    return true;
  }
  if (value && typeof value === 'object') {
    return true;
  }
  return false;
}
