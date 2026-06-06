const KNOWN_PROVIDER_PREFIXES = [
  'openai/',
  'anthropic/',
  'google/',
  'meta-llama/',
  'mistralai/',
  'minimax/',
  'deepseek/',
  'qwen/',
  'cohere/',
  'perplexity/',
  'x-ai/',
  'openrouter/',
  'azure/',
  'azure_ai/',
  'bedrock/',
  'vertex_ai/',
  'together/',
  'together_ai/',
  'fireworks_ai/',
  'groq/'
] as const;

const CANONICAL_PROVIDER_SEGMENTS = new Map<string, string>([
  ['anthropic', 'anthropic'],
  ['azure', 'azure_ai'],
  ['azure_ai', 'azure_ai'],
  ['bedrock', 'bedrock'],
  ['deepseek', 'deepseek'],
  ['fireworks', 'fireworks_ai'],
  ['fireworks_ai', 'fireworks_ai'],
  ['gemini', 'google'],
  ['google', 'google'],
  ['meta', 'meta_llama'],
  ['meta_llama', 'meta_llama'],
  ['mistral', 'mistralai'],
  ['mistralai', 'mistralai'],
  ['moonshot', 'moonshotai'],
  ['moonshotai', 'moonshotai'],
  ['openai', 'openai'],
  ['openai_codex', 'openai'],
  ['openrouter', 'openrouter'],
  ['together', 'together_ai'],
  ['together_ai', 'together_ai'],
  ['vertex', 'anthropic'],
  ['vertex_ai', 'anthropic'],
  ['x_ai', 'xai'],
  ['xai', 'xai'],
  ['z_ai', 'zai'],
  ['zai', 'zai']
]);

const ORIGINAL_PROVIDER_PREFIXES = new Map<string, string>([
  ['anthropic', 'anthropic'],
  ['cohere', 'cohere'],
  ['deepseek', 'deepseek'],
  ['google', 'google'],
  ['meta-llama', 'meta_llama'],
  ['minimax', 'minimax'],
  ['mistralai', 'mistralai'],
  ['moonshotai', 'moonshotai'],
  ['openai', 'openai'],
  ['perplexity', 'perplexity'],
  ['qwen', 'qwen'],
  ['x-ai', 'xai'],
  ['xai', 'xai'],
  ['z-ai', 'zai'],
  ['zai', 'zai']
]);

type PricingAlias = {
  provider: string;
  model: string;
  normalizedProvider: string;
  normalizedModel: string;
};

const PRICING_ALIASES: PricingAlias[] = [
  {
    provider: 'openai',
    model: 'gpt-4.1-2025-04-14',
    normalizedProvider: 'openai',
    normalizedModel: 'gpt-4.1'
  },
  {
    provider: 'openai',
    model: 'gpt-4.1-mini-2025-04-14',
    normalizedProvider: 'openai',
    normalizedModel: 'gpt-4.1-mini'
  },
  {
    provider: 'openai',
    model: 'gpt-5.5-latest',
    normalizedProvider: 'openai',
    normalizedModel: 'gpt-5.5'
  },
  {
    provider: 'openai',
    model: 'gpt-5.5-fast-latest',
    normalizedProvider: 'openai',
    normalizedModel: 'gpt-5.5-fast'
  },
  {
    provider: 'cursor',
    model: 'model_placeholder_m26',
    normalizedProvider: 'anthropic',
    normalizedModel: 'claude-opus-4-6'
  },
  {
    provider: 'cursor',
    model: 'model_placeholder_m35',
    normalizedProvider: 'anthropic',
    normalizedModel: 'claude-sonnet-4-6'
  },
  {
    provider: 'cursor',
    model: 'model_placeholder_m36',
    normalizedProvider: 'google',
    normalizedModel: 'gemini-3.1-pro'
  },
  {
    provider: 'cursor',
    model: 'model_placeholder_m37',
    normalizedProvider: 'google',
    normalizedModel: 'gemini-3.1-pro'
  },
  {
    provider: 'cursor',
    model: 'model_placeholder_m47',
    normalizedProvider: 'google',
    normalizedModel: 'gemini-3-flash-preview'
  },
  {
    provider: 'cursor',
    model: 'claude-opus-4-6-thinking',
    normalizedProvider: 'anthropic',
    normalizedModel: 'claude-opus-4-6'
  },
  {
    provider: 'cursor',
    model: 'claude-sonnet-4-6-thinking',
    normalizedProvider: 'anthropic',
    normalizedModel: 'claude-sonnet-4-6'
  },
  {
    provider: 'cursor',
    model: 'claude-opus-4.6-thinking',
    normalizedProvider: 'anthropic',
    normalizedModel: 'claude-opus-4-6'
  },
  {
    provider: 'cursor',
    model: 'claude-sonnet-4.6-thinking',
    normalizedProvider: 'anthropic',
    normalizedModel: 'claude-sonnet-4-6'
  },
  {
    provider: 'cursor',
    model: 'claude-opus-4.6',
    normalizedProvider: 'anthropic',
    normalizedModel: 'claude-opus-4-6'
  },
  {
    provider: 'cursor',
    model: 'claude-sonnet-4.6',
    normalizedProvider: 'anthropic',
    normalizedModel: 'claude-sonnet-4-6'
  },
  {
    provider: 'cursor',
    model: 'gemini-3.1-pro-high',
    normalizedProvider: 'google',
    normalizedModel: 'gemini-3.1-pro'
  },
  {
    provider: 'cursor',
    model: 'gemini-3.1-pro-low',
    normalizedProvider: 'google',
    normalizedModel: 'gemini-3.1-pro'
  }
];

export type PricingNormalization = {
  provider: string;
  model: string;
  aliasMatched: boolean;
  prefixStripped: boolean;
};

export function normalizePricingModel(provider: string, model: string): PricingNormalization {
  const normalizedProvider = canonicalPricingProvider(provider) ?? provider.trim().toLowerCase();
  const trimmedModel = model.trim().toLowerCase();
  const providerScoped = normalizeProviderScopedModel(trimmedModel);
  const lookupProvider = providerScoped.provider ?? normalizedProvider;
  const { model: prefixNormalizedModel, prefixStripped } = stripKnownProviderPrefix(
    providerScoped.model
  );
  const exactAlias = findPricingAlias(lookupProvider, prefixNormalizedModel);
  const aliasInput = stripCursorRoutingAndTiers(prefixNormalizedModel);
  const alias = exactAlias ?? findPricingAlias(lookupProvider, aliasInput.model);

  if (alias) {
    return {
      provider: alias.normalizedProvider,
      model: alias.normalizedModel,
      aliasMatched: true,
      prefixStripped:
        prefixStripped ||
        providerScoped.prefixStripped ||
        (!exactAlias && aliasInput.prefixStripped)
    };
  }

  return {
    provider: lookupProvider,
    model: prefixNormalizedModel,
    aliasMatched: false,
    prefixStripped: prefixStripped || providerScoped.prefixStripped
  };
}

function canonicalPricingProvider(raw: string): string | null {
  const segments = raw.trim().replace(/\/+$/u, '').split('/');
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index] ?? '';
    const normalized = segment.trim().toLowerCase().replaceAll('-', '_');
    const canonical = CANONICAL_PROVIDER_SEGMENTS.get(normalized);
    if (canonical) return canonical;
  }
  return null;
}

function findPricingAlias(provider: string, model: string): PricingAlias | undefined {
  return PRICING_ALIASES.find((entry) => entry.provider === provider && entry.model === model);
}

function stripKnownProviderPrefix(model: string): { model: string; prefixStripped: boolean } {
  const prefix = KNOWN_PROVIDER_PREFIXES.find((knownPrefix) => model.startsWith(knownPrefix));

  if (!prefix) {
    return { model, prefixStripped: false };
  }

  return { model: model.slice(prefix.length), prefixStripped: true };
}

export function canonicalProvider(raw: string): string | null {
  const tags = providerTags(raw);
  return tags[0] ?? null;
}

export function providerTags(raw: string): string[] {
  const tags: string[] = [];
  for (const segment of raw.trim().replace(/\/+$/u, '').split('/')) {
    pushProviderTag(tags, segment);
    if (segment.includes('.')) {
      for (const dotted of segment.split('.')) pushProviderTag(tags, dotted);
    }
  }
  return tags;
}

export function inferredProviderFromModel(model: string): string | null {
  const lower = model.toLowerCase();
  if (lower.includes('claude') || lower.includes('anthropic') || containsDelimited(lower, 'opus')) {
    return 'anthropic';
  }
  if (lower.includes('sonnet') || lower.includes('haiku')) return 'anthropic';
  if (lower.includes('gpt') || lower.includes('openai')) return 'openai';
  if (
    containsDelimited(lower, 'o1') ||
    containsDelimited(lower, 'o3') ||
    containsDelimited(lower, 'o4')
  ) {
    return 'openai';
  }
  if (lower.includes('gemini') || lower.includes('google')) return 'google';
  if (lower.includes('grok')) return 'xai';
  if (lower.includes('deepseek')) return 'deepseek';
  if (lower.includes('mistral') || lower.includes('mixtral')) return 'mistralai';
  if (lower.includes('llama') || containsDelimited(lower, 'meta')) return 'meta_llama';
  if (lower.includes('qwen')) return 'qwen';
  return null;
}

function pushProviderTag(tags: string[], segment: string): void {
  const tag = canonicalizeProviderSegment(segment);
  if (tag && !tags.includes(tag)) tags.push(tag);
}

function canonicalizeProviderSegment(segment: string): string | null {
  const normalized = segment.trim().replace(/\/+$/u, '').toLowerCase().replaceAll('-', '_');
  if (!normalized || normalized === 'unknown') return null;
  if (normalized.startsWith('<') && normalized.endsWith('>')) return null;
  if (/\d/u.test(normalized)) return null;
  return CANONICAL_PROVIDER_SEGMENTS.get(normalized) ?? normalized;
}

function normalizeProviderScopedModel(model: string): {
  provider: string | null;
  model: string;
  prefixStripped: boolean;
} {
  const separator = model.indexOf('/');
  if (separator < 1) return { provider: null, model, prefixStripped: false };

  const rawPrefix = model.slice(0, separator);
  const provider = ORIGINAL_PROVIDER_PREFIXES.get(rawPrefix);
  if (!provider) return { provider: null, model, prefixStripped: false };
  return { provider, model: model.slice(separator + 1), prefixStripped: true };
}

const MIN_MODEL_NAME_LEN = 2;
const MAX_PREFIX_STRIP_SEGMENTS = 2;
const MAX_SUFFIX_STRIP_SEGMENTS = 4;

function stripCursorRoutingAndTiers(model: string): { model: string; prefixStripped: boolean } {
  for (const candidate of strippedRoutingCandidates(model)) {
    const alias = findPricingAlias('cursor', candidate.model);
    if (alias) return candidate;
  }
  return { model, prefixStripped: false };
}

function strippedRoutingCandidates(
  model: string
): Array<{ model: string; prefixStripped: boolean }> {
  const candidates: Array<{ model: string; prefixStripped: boolean }> = [];
  pushRoutingCandidate(candidates, model, false);
  for (const suffixCandidate of stripUnknownSuffixes(model)) {
    pushRoutingCandidate(candidates, suffixCandidate, true);
  }
  for (const prefixCandidate of stripUnknownPrefixes(model)) {
    pushRoutingCandidate(candidates, prefixCandidate, true);
    for (const suffixCandidate of stripUnknownSuffixes(prefixCandidate)) {
      pushRoutingCandidate(candidates, suffixCandidate, true);
    }
  }
  return candidates;
}

function stripUnknownPrefixes(model: string): string[] {
  const parts = model.split('-');
  const maxSkip = Math.min(parts.length - 1, MAX_PREFIX_STRIP_SEGMENTS);
  const candidates: string[] = [];
  for (let skip = 1; skip <= maxSkip; skip += 1) {
    candidates.push(parts.slice(skip).join('-'));
  }
  return candidates;
}

function stripUnknownSuffixes(model: string): string[] {
  const parts = model.split('-');
  const maxStrip = Math.min(parts.length - 1, MAX_SUFFIX_STRIP_SEGMENTS);
  const candidates: string[] = [];
  for (let strip = 1; strip <= maxStrip; strip += 1) {
    candidates.push(parts.slice(0, parts.length - strip).join('-'));
  }
  return candidates;
}

function pushRoutingCandidate(
  candidates: Array<{ model: string; prefixStripped: boolean }>,
  model: string,
  prefixStripped: boolean
): void {
  if (model.length < MIN_MODEL_NAME_LEN) return;
  if (!candidates.some((candidate) => candidate.model === model)) {
    candidates.push({ model, prefixStripped });
  }
}

function containsDelimited(haystack: string, needle: string): boolean {
  for (const match of haystack.matchAll(new RegExp(needle, 'gu'))) {
    const index = match.index ?? 0;
    const before = haystack.at(index - 1);
    const after = haystack.at(index + needle.length);
    if (isDelimiter(before) && isDelimiter(after)) return true;
  }
  return false;
}

function isDelimiter(value: string | undefined): boolean {
  return value === undefined || !/[a-z0-9]/u.test(value);
}
