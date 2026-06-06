import type {
  ExternalPricingModel,
  ExternalPricingModelInput,
  PricingModelsRepository
} from '../db/repositories/pricingModels.js';

const LITELLM_PRICING_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const TOKEN_PRICE_MULTIPLIER = 1_000_000;

type RefreshOptions = {
  fetch?: typeof fetch;
  fetchedAt?: string;
};

type LiteLlmPricingEntry = {
  litellm_provider?: unknown;
  input_cost_per_token?: unknown;
  output_cost_per_token?: unknown;
  cache_read_input_token_cost?: unknown;
};

type OpenRouterModel = {
  id?: unknown;
  pricing?: {
    prompt?: unknown;
    completion?: unknown;
    input_cache_read?: unknown;
  };
};

export async function refreshLiteLlmPricing(
  repository: PricingModelsRepository,
  options: RefreshOptions = {}
): Promise<ExternalPricingModel[]> {
  const payload = await fetchJson(LITELLM_PRICING_URL, options.fetch);
  const rows = parseLiteLlmPricing(payload);
  return repository.replaceExternalCache(
    'litellm',
    rows,
    options.fetchedAt ?? new Date().toISOString()
  );
}

export async function refreshOpenRouterPricing(
  repository: PricingModelsRepository,
  options: RefreshOptions = {}
): Promise<ExternalPricingModel[]> {
  const payload = await fetchJson(OPENROUTER_MODELS_URL, options.fetch);
  const rows = parseOpenRouterPricing(payload);
  return repository.replaceExternalCache(
    'openrouter',
    rows,
    options.fetchedAt ?? new Date().toISOString()
  );
}

export function parseLiteLlmPricing(payload: unknown): ExternalPricingModelInput[] {
  if (!isRecord(payload)) throw new Error('validation_failed');
  const rows: ExternalPricingModelInput[] = [];

  for (const [modelId, entry] of Object.entries(payload)) {
    if (!isRecord(entry)) continue;
    const pricing = entry as LiteLlmPricingEntry;
    const inputPricePerMillion = tokenPriceToPerMillion(pricing.input_cost_per_token);
    const outputPricePerMillion = tokenPriceToPerMillion(pricing.output_cost_per_token);
    if (inputPricePerMillion === null || outputPricePerMillion === null) continue;

    const provider = providerFromValue(pricing.litellm_provider) ?? providerFromModelId(modelId);
    if (!provider) continue;
    const cachedInputPricePerMillion = tokenPriceToPerMillion(pricing.cache_read_input_token_cost);

    rows.push({
      provider,
      model: modelId,
      inputPricePerMillion,
      outputPricePerMillion,
      cachedInputPricePerMillion
    });
  }

  return rows;
}

export function parseOpenRouterPricing(payload: unknown): ExternalPricingModelInput[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) throw new Error('validation_failed');
  const rows: ExternalPricingModelInput[] = [];

  for (const item of payload.data as OpenRouterModel[]) {
    if (!isRecord(item) || typeof item.id !== 'string' || !isRecord(item.pricing)) continue;
    const inputPricePerMillion = tokenPriceToPerMillion(item.pricing.prompt);
    const outputPricePerMillion = tokenPriceToPerMillion(item.pricing.completion);
    if (inputPricePerMillion === null || outputPricePerMillion === null) continue;

    const cachedInputPricePerMillion = tokenPriceToPerMillion(item.pricing.input_cache_read);
    rows.push({
      provider: providerFromModelId(item.id) ?? 'openrouter',
      model: item.id,
      inputPricePerMillion,
      outputPricePerMillion,
      cachedInputPricePerMillion
    });
  }

  return rows;
}

async function fetchJson(url: string, fetchImpl: typeof fetch = fetch): Promise<unknown> {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error('pricing_refresh_failed');
  return response.json();
}

function tokenPriceToPerMillion(value: unknown): number | null {
  const price = parseTokenPrice(value);
  return price === null ? null : price * TOKEN_PRICE_MULTIPLIER;
}

function parseTokenPrice(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function providerFromValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function providerFromModelId(modelId: string): string | null {
  const separator = modelId.indexOf('/');
  if (separator <= 0) return null;
  return modelId.slice(0, separator);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
