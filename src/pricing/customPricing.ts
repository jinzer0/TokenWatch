import { defaultPrices, type PriceModel } from './defaultPrices.js';
import { normalizePricingModel } from './normalization.js';

export type CustomPriceCandidate = {
  provider: string;
  model: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  cachedInputPricePerMillion?: number | null;
  source: 'custom';
  active: boolean;
  enabled: boolean;
};

export type ResolvedPriceModel = PriceModel & {
  source: 'custom' | 'default';
};

export function findPriceWithCustom(
  provider: string,
  model: string,
  customPrices: readonly CustomPriceCandidate[]
): ResolvedPriceModel | null {
  const normalized = normalizePricingModel(provider, model);
  const custom = customPrices.find(
    (price) =>
      price.active &&
      price.enabled &&
      price.provider === normalized.provider &&
      price.model === normalized.model
  );
  if (custom) {
    return {
      provider: custom.provider,
      model: custom.model,
      inputPricePerMillion: custom.inputPricePerMillion,
      outputPricePerMillion: custom.outputPricePerMillion,
      cachedInputPricePerMillion: custom.cachedInputPricePerMillion ?? undefined,
      source: 'custom'
    };
  }

  const defaultPrice = findDefaultPrice(normalized.provider, normalized.model);
  return defaultPrice ? { ...defaultPrice, source: 'default' } : null;
}

function findDefaultPrice(provider: string, model: string): PriceModel | null {
  return (
    defaultPrices.find((price) => price.provider === provider && price.model === model) ?? null
  );
}
