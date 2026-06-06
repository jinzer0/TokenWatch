import { defaultPrices, type PriceModel } from './defaultPrices.js';
export { normalizePricingModel, type PricingNormalization } from './normalization.js';
export {
  findPriceWithCustom,
  type CustomPriceCandidate,
  type ResolvedPriceModel
} from './customPricing.js';
export type { PriceModel } from './defaultPrices.js';
export {
  parseLiteLlmPricing,
  parseOpenRouterPricing,
  refreshLiteLlmPricing,
  refreshOpenRouterPricing
} from './externalSources.js';
export {
  ensureExternalPricingCache,
  PRICING_LOOKUP_WARNING,
  type PricingLookupRefreshOptions,
  type PricingLookupRefreshResult
} from './lookupRefresh.js';
export {
  PricingResolver,
  resolveBundledPricing,
  type PricingConfidence,
  type PricingResolution,
  type PricingResolverInput,
  type PricingSource
} from './resolver.js';

export function findPrice(provider: string, model: string): PriceModel | null {
  const normalizedProvider = provider.toLowerCase();
  const normalizedModel = model.toLowerCase();
  return (
    defaultPrices.find(
      (price) =>
        price.provider.toLowerCase() === normalizedProvider &&
        price.model.toLowerCase() === normalizedModel
    ) ?? null
  );
}

export function estimateCostUsd(input: {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
}): number | null {
  const price = findPrice(input.provider, input.model);
  if (!price) {
    return null;
  }
  const inputCost = (input.inputTokens / 1_000_000) * price.inputPricePerMillion;
  const outputCost = (input.outputTokens / 1_000_000) * price.outputPricePerMillion;
  const cachedCost =
    ((input.cachedTokens ?? 0) / 1_000_000) * (price.cachedInputPricePerMillion ?? 0);
  return roundCost(inputCost + outputCost + cachedCost);
}

export function roundCost(value: number): number {
  return Number(value.toFixed(8));
}
