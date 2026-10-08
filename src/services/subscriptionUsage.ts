import {
  subscriptionProviderSchema,
  subscriptionReadResultSchema,
  type SubscriptionProvider,
  type SubscriptionReadResult
} from '../desktop/shared/subscriptionContracts.js';

/** Validate a collector result without exposing source objects or validation errors. */
export async function readSubscriptionUsage(
  provider: SubscriptionProvider,
  collect: () => Promise<SubscriptionReadResult>,
  now: () => Date = () => new Date()
): Promise<SubscriptionReadResult> {
  if (!subscriptionProviderSchema.safeParse(provider).success) {
    throw new Error('Invalid subscription provider');
  }
  try {
    const parsed = subscriptionReadResultSchema.safeParse(await collect());
    if (parsed.success && parsed.data.provider === provider) return parsed.data;
  } catch {
    return failure(provider, 'client-failed', now());
  }
  return failure(provider, 'invalid-data', now());
}

function failure(
  provider: SubscriptionProvider,
  reason: 'client-failed' | 'invalid-data',
  received: Date
): SubscriptionReadResult {
  return {
    provider,
    availability: 'error',
    failure: reason,
    receivedAt: received.toISOString(),
    windows: []
  };
}
