import { afterEach, describe, expect, it, vi } from 'vitest';
import { containsPrivacySentinel } from './helpers.js';

async function loadProviderUsage(): Promise<Record<string, unknown>> {
  return import('../src/services/providerUsage.js') as Promise<Record<string, unknown>>;
}

function createProbe(
  moduleExports: Record<string, unknown>
): (options: Record<string, unknown>) => Promise<unknown> {
  expect(moduleExports.probeProviderUsage).toBeTypeOf('function');
  return moduleExports.probeProviderUsage as (options: Record<string, unknown>) => Promise<unknown>;
}

describe('provider usage probe contract', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('reports missing env token as not_configured without network access', async () => {
    const probe = createProbe(await loadProviderUsage());
    vi.stubEnv('OPENAI_API_KEY', '');
    const fetchMock = vi.fn();

    await expect(probe({ provider: 'openai', fetch: fetchMock })).resolves.toMatchObject({
      provider: 'openai',
      status: 'not_configured',
      quota: 'unknown',
      rateLimit: 'unknown',
      source: 'env-only-live',
      warnings: []
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects unsupported providers with invalid_provider', async () => {
    const probe = createProbe(await loadProviderUsage());

    await expect(
      probe({ provider: 'PROMPT_SENTINEL_DO_NOT_LEAK', fetch: vi.fn() })
    ).rejects.toThrow('invalid_provider');
  });

  it('sanitizes timeout and network failures without leaking tokens', async () => {
    const probe = createProbe(await loadProviderUsage());
    vi.stubEnv('OPENAI_API_KEY', 'FAKE_API_KEY_SENTINEL_DO_NOT_LEAK');
    const fetchMock = vi.fn(async () => {
      throw new Error('network failure FAKE_API_KEY_SENTINEL_DO_NOT_LEAK');
    });

    const result = await probe({ provider: 'openai', fetch: fetchMock, timeoutMs: 1 });

    expect(result).toMatchObject({
      provider: 'openai',
      status: 'error',
      quota: 'unknown',
      rateLimit: 'unknown',
      source: 'env-only-live',
      error: { code: 'provider_usage_unavailable', message: 'provider_usage_unavailable' }
    });
    expect(containsPrivacySentinel(result)).toBe(false);
  });

  it('parses rate-limit headers and treats absent fields as unknown', async () => {
    const probe = createProbe(await loadProviderUsage());
    vi.stubEnv('OPENAI_API_KEY', 'test-env-token');
    const fetchMock = vi.fn(async () => ({
      ok: true,
      headers: new Headers({
        'x-ratelimit-limit-tokens': '1000000',
        'x-ratelimit-remaining-tokens': '750000',
        'x-ratelimit-reset-tokens': '60s'
      }),
      json: async () => ({})
    }));

    await expect(probe({ provider: 'openai', fetch: fetchMock })).resolves.toMatchObject({
      provider: 'openai',
      status: 'ok',
      quota: 'unknown',
      rateLimit: { limit: 1000000, remaining: 750000 },
      resetAt: expect.any(String),
      source: 'env-only-live',
      warnings: []
    });
  });

  it('never serializes env-only provider credentials', async () => {
    const probe = createProbe(await loadProviderUsage());
    vi.stubEnv('ANTHROPIC_API_KEY', 'FAKE_CREDENTIAL_SENTINEL_DO_NOT_LEAK');
    const fetchMock = vi.fn(async () => ({
      ok: true,
      headers: new Headers(),
      json: async () => ({})
    }));
    const result = await probe({ provider: 'anthropic', fetch: fetchMock });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: expect.any(Object) })
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('anthropic');
    expect(containsPrivacySentinel(result)).toBe(false);
  });
});
