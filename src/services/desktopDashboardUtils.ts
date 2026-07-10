import type { UsageEvent } from '../models/usageEvent.js';
import { localDayBucket } from '../utils/time.js';

export function groupEventsByDay(events: readonly UsageEvent[]): Map<string, UsageEvent[]> {
  const groups = new Map<string, UsageEvent[]>();
  for (const event of events) {
    const key = localDayBucket(event.timestamp);
    const group = groups.get(key) ?? [];
    group.push(event);
    groups.set(key, group);
  }
  return groups;
}

export function sumNumericEventField(
  events: readonly UsageEvent[],
  field: keyof UsageEvent
): number {
  return events.reduce((total, event) => {
    const value = event[field];
    return typeof value === 'number' ? total + value : total;
  }, 0);
}
