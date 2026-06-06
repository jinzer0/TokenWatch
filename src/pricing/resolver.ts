import { PRICING_VERSION } from '../app/constants.js';
import type {
  CustomPricingModel,
  ExternalPricingModel,
  ExternalPricingSource,
  PricingModelsRepository
} from '../db/repositories/pricingModels.js';
import { defaultPrices, type PriceModel } from './defaultPrices.js';
import { inferredProviderFromModel, normalizePricingModel } from './normalization.js';

export type PricingSource = 'custom' | ExternalPricingSource | 'bundled' | 'cursor' | 'unknown';
export type PricingConfidence =
  | 'exact'
  | 'alias'
  | 'provider-prefix'
  | 'cursor-override'
  | 'fuzzy'
  | 'none';

export type PricingResolution = {
  estimatedCostUsd: number | null;
  pricingSource: PricingSource;
  pricingConfidence: PricingConfidence;
  pricingVersion: string;
  normalizedProvider: string;
  normalizedModel: string;
};

export type PricingResolverInput = {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
};

type ResolvedPricingModel = PriceModel & {
  source: Exclude<PricingSource, 'unknown'>;
  confidence: Exclude<PricingConfidence, 'none'>;
};

const EXTERNAL_PRECEDENCE: ExternalPricingSource[] = ['litellm', 'openrouter'];

export function resolveBundledPricing(input: PricingResolverInput): PricingResolution {
  const normalized = normalizePricingModel(input.provider, input.model);
  const price = findBundledPrice(normalized.provider, normalized.model);
  return resolvePricingInput(
    input,
    price?.provider ?? normalized.provider,
    price?.model ?? normalized.model,
    price
  );
}

export class PricingResolver {
  constructor(private readonly pricingModelsRepository: PricingModelsRepository) {}

  resolve(input: PricingResolverInput): PricingResolution {
    const normalized = normalizePricingModel(input.provider, input.model);
    const price = this.findPrice(normalized.provider, normalized.model, input);
    return resolvePricingInput(
      input,
      price?.provider ?? normalized.provider,
      price?.model ?? normalized.model,
      price
    );
  }

  private findPrice(
    provider: string,
    model: string,
    input: Pick<PricingResolverInput, 'provider' | 'model'>
  ): ResolvedPricingModel | null {
    const normalizedInput = normalizePricingModel(input.provider, input.model);
    const directCustom =
      this.pricingModelsRepository.getCustom(input.provider, input.model) ??
      this.pricingModelsRepository.getCustom(input.provider, model);
    if (isUsablePricingModel(directCustom)) return toResolvedPrice(directCustom, 'exact');

    const custom = this.pricingModelsRepository.getCustom(provider, model);
    if (isUsablePricingModel(custom)) return toResolvedPrice(custom, 'exact');

    for (const source of EXTERNAL_PRECEDENCE) {
      const external = this.pricingModelsRepository.getExternal(source, provider, model);
      if (isUsablePricingModel(external)) {
        return toResolvedPrice(external, directExternalConfidence(input, normalizedInput));
      }
    }

    if (provider === 'cursor') {
      const inferredProvider = inferredProviderFromModel(model);
      if (inferredProvider) {
        for (const source of EXTERNAL_PRECEDENCE) {
          const external = this.pricingModelsRepository.getExternal(
            source,
            inferredProvider,
            model
          );
          if (isUsablePricingModel(external)) return toResolvedPrice(external, 'exact');
        }
      }
    }

    for (const source of EXTERNAL_PRECEDENCE) {
      const externalAlias = this.pricingModelsRepository.getExternalAlias(
        source,
        input.provider,
        input.model
      );
      if (externalAlias) return toResolvedPrice(externalAlias, 'exact');
    }

    const cursorOverride = findCursorOverride(provider, model);
    if (cursorOverride) return cursorOverride;

    for (const source of EXTERNAL_PRECEDENCE) {
      const fuzzy = this.pricingModelsRepository.findExternalFuzzy(source, provider, model);
      if (fuzzy) return toResolvedPrice(fuzzy, 'fuzzy');
    }

    return findBundledPrice(provider, model);
  }
}

function resolvePricingInput(
  input: PricingResolverInput,
  normalizedProvider: string,
  normalizedModel: string,
  price: ResolvedPricingModel | null
): PricingResolution {
  if (!price) {
    return {
      estimatedCostUsd: null,
      pricingSource: 'unknown',
      pricingConfidence: 'none',
      pricingVersion: PRICING_VERSION,
      normalizedProvider,
      normalizedModel
    };
  }

  return {
    estimatedCostUsd: calculateCostUsd(input, price),
    pricingSource: price.source,
    pricingConfidence: price.confidence,
    pricingVersion: PRICING_VERSION,
    normalizedProvider: price.provider,
    normalizedModel: price.model
  };
}

function findBundledPrice(provider: string, model: string): ResolvedPricingModel | null {
  const bundled = defaultPrices.find(
    (price) => price.provider === provider && price.model === model
  );
  return bundled ? { ...bundled, source: 'bundled', confidence: 'exact' } : null;
}

function isUsablePricingModel(
  model: CustomPricingModel | ExternalPricingModel | null
): model is CustomPricingModel | ExternalPricingModel {
  return Boolean(model?.active && model.enabled);
}

function toResolvedPrice(
  model: CustomPricingModel | ExternalPricingModel,
  confidence: Exclude<PricingConfidence, 'none'>
): ResolvedPricingModel {
  return {
    provider: model.provider,
    model: model.model,
    inputPricePerMillion: model.inputPricePerMillion,
    outputPricePerMillion: model.outputPricePerMillion,
    cachedInputPricePerMillion: model.cachedInputPricePerMillion ?? undefined,
    source: model.source,
    confidence
  };
}

function directExternalConfidence(
  input: Pick<PricingResolverInput, 'provider' | 'model'>,
  normalized: ReturnType<typeof normalizePricingModel>
): Exclude<PricingConfidence, 'none'> {
  const rawProvider = input.provider.trim().toLowerCase();
  if (normalized.prefixStripped) return 'provider-prefix';
  return normalized.aliasMatched && normalized.provider !== rawProvider ? 'alias' : 'exact';
}

const CURSOR_OVERRIDES: PriceModel[] = [
  cursorOverride('gpt-5.3', 1.75, 14, 0.175),
  cursorOverride('gpt-5.3-codex', 1.75, 14, 0.175),
  cursorOverride('gpt-5.3-codex-spark', 1.75, 14, 0.175),
  cursorOverride('composer 1', 1.25, 10, 0.125),
  cursorOverride('composer-1', 1.25, 10, 0.125),
  cursorOverride('composer 1.5', 3.5, 17.5, 0.35),
  cursorOverride('composer-1.5', 3.5, 17.5, 0.35),
  cursorOverride('composer 2', 0.5, 2.5, 0.2),
  cursorOverride('composer-2', 0.5, 2.5, 0.2),
  cursorOverride('composer 2 fast', 1.5, 7.5, 0.35),
  cursorOverride('composer-2-fast', 1.5, 7.5, 0.35),
  cursorOverride('composer-2.5', 0.5, 2.5, 0.2),
  cursorOverride('composer-2.5-fast', 1.5, 7.5, 0.35)
];

function findCursorOverride(provider: string, model: string): ResolvedPricingModel | null {
  if (provider !== 'cursor') return null;
  const override = CURSOR_OVERRIDES.find((entry) => entry.model === model);
  if (!override) return null;
  return { ...override, source: 'cursor', confidence: 'cursor-override' };
}

function cursorOverride(
  model: string,
  inputPricePerMillion: number,
  outputPricePerMillion: number,
  cachedInputPricePerMillion: number
): PriceModel {
  return {
    provider: inferredProviderFromModel(model) ?? 'cursor',
    model,
    inputPricePerMillion,
    outputPricePerMillion,
    cachedInputPricePerMillion
  };
}

function calculateCostUsd(input: PricingResolverInput, price: PriceModel): number {
  const inputCost = (input.inputTokens / 1_000_000) * price.inputPricePerMillion;
  const outputCost = (input.outputTokens / 1_000_000) * price.outputPricePerMillion;
  const cachedCost =
    ((input.cachedTokens ?? 0) / 1_000_000) * (price.cachedInputPricePerMillion ?? 0);
  return roundCost(inputCost + outputCost + cachedCost);
}

function roundCost(value: number): number {
  return Number(value.toFixed(8));
}
