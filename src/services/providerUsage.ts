import { TokenWatchError } from '../app/errors.js';
import {
  providerUsageProbeReportSchema,
  type ProviderUsageProbeReport,
  type ProviderUsageReport
} from './reportContracts.js';

const PROVIDERS = ['openai', 'anthropic'] as const;
const SOURCE = 'env-only-live' as const;

type ProviderName = (typeof PROVIDERS)[number];
type FetchImpl = typeof fetch;
type ProviderUsageStatus = ProviderUsageReport['status'];

export type ProviderUsageProbeOptions = {
  provider: string;
  fetch?: FetchImpl;
  timeoutMs?: number;
};

type ProviderDefinition = {
  envName: 'OPENAI_API_KEY' | 'ANTHROPIC_API_KEY';
  url: string;
  headers(token: string): Record<string, string>;
};

const PROVIDER_DEFINITIONS: Record<ProviderName, ProviderDefinition> = {
  openai: {
    envName: 'OPENAI_API_KEY',
    url: 'https://api.openai.com/v1/models',
    headers: (token) => ({ Authorization: `Bearer ${token}` })
  },
  anthropic: {
    envName: 'ANTHROPIC_API_KEY',
    url: 'https://api.anthropic.com/v1/models',
    headers: (token) => ({
      'anthropic-version': '2023-06-01',
      'x-api-key': token
    })
  }
};

export async function probeProviderUsage(
  options: ProviderUsageProbeOptions
): Promise<ProviderUsageProbeReport> {
  const provider = parseProvider(options.provider);
  const definition = PROVIDER_DEFINITIONS[provider];
  const token = process.env[definition.envName]?.trim();

  if (!token) {
    return providerUsageProbeReportSchema.parse(baseReport(provider, 'not_configured'));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 5000);
  try {
    const response = await (options.fetch ?? fetch)(definition.url, {
      method: 'GET',
      headers: definition.headers(token),
      signal: controller.signal
    });

    return providerUsageProbeReportSchema.parse({
      ...baseReport(provider, response.ok ? 'ok' : 'error'),
      httpStatus: parseHttpStatus(response.status),
      rateLimit: parseRateLimit(response.headers),
      resetAt: parseResetAt(response.headers)
    });
  } catch {
    return providerUsageProbeReportSchema.parse({
      ...baseReport(provider, 'error'),
      error: {
        code: 'provider_usage_unavailable',
        message: 'provider_usage_unavailable'
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}

function parseProvider(provider: string): ProviderName {
  if (PROVIDERS.includes(provider as ProviderName)) return provider as ProviderName;
  throw new TokenWatchError('invalid_provider', 1, 'invalid_provider');
}

function baseReport(provider: ProviderName, status: ProviderUsageStatus): ProviderUsageReport {
  return {
    provider,
    status,
    httpStatus: null,
    quota: 'unknown',
    rateLimit: 'unknown',
    resetAt: null,
    checkedAt: new Date().toISOString(),
    source: SOURCE,
    warnings: []
  };
}

function parseRateLimit(headers: Headers): ProviderUsageReport['rateLimit'] {
  const limit = parseNonNegativeNumber(headers.get('x-ratelimit-limit-tokens'));
  const remaining = parseNonNegativeNumber(headers.get('x-ratelimit-remaining-tokens'));
  if (limit === null && remaining === null) return 'unknown';
  return { limit, remaining };
}

function parseHttpStatus(status: number): ProviderUsageReport['httpStatus'] {
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : null;
}

function parseResetAt(headers: Headers): string | null {
  const value = headers.get('x-ratelimit-reset-tokens')?.trim();
  if (!value) return null;
  const relativeSeconds = value.match(/^(\d+(?:\.\d+)?)s$/i);
  if (relativeSeconds) {
    return new Date(Date.now() + Number(relativeSeconds[1]) * 1000).toISOString();
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function parseNonNegativeNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
