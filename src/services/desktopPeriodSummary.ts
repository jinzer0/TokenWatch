import type { DesktopPeriodSummary } from '../desktop/shared/contracts.js';
import type { UsageEvent } from '../models/usageEvent.js';

const calendarOffset = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const localDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

export function buildDesktopPeriodSummary(events: UsageEvent[], now: Date): DesktopPeriodSummary {
  const nowMs = now.getTime();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const weekStart = calendarOffset(dayStart, -((dayStart.getDay() + 6) % 7));
  const timedEvents = events.map((event) => ({ event, timestamp: Date.parse(event.timestamp) }));

  const summarize = (start: Date, days: number): DesktopPeriodSummary['day'] => {
    const startMs = start.getTime();
    const previousStartMs = calendarOffset(start, -days).getTime();
    const previousEndMs = Math.min(startMs, previousStartMs + (nowMs - startMs));
    let tokens = 0;
    let cost = 0;
    let unknownCost = false;
    let previousTokens = 0;

    for (const { event, timestamp } of timedEvents) {
      if (timestamp >= startMs && timestamp <= nowMs) {
        tokens += event.totalTokens;
        if (event.estimatedCostUsd === null) unknownCost = true;
        else cost += event.estimatedCostUsd;
      }
      // A clipped previous window must not include the current period's start.
      if (timestamp >= previousStartMs && timestamp <= previousEndMs && timestamp < startMs) {
        previousTokens += event.totalTokens;
      }
    }

    const changePercent =
      previousTokens === 0 ? null : ((tokens - previousTokens) / previousTokens) * 100;
    return {
      tokens,
      estimatedCostUsd: unknownCost ? null : cost,
      previousTokens,
      changePercent: changePercent !== null && Number.isFinite(changePercent) ? changePercent : null
    };
  };

  const trend = Array.from({ length: 7 }, (_, index) => {
    const start = calendarOffset(dayStart, index - 6);
    const startMs = start.getTime();
    const endMs = calendarOffset(start, 1).getTime();
    let tokens = 0;
    for (const { event, timestamp } of timedEvents) {
      if (timestamp >= startMs && timestamp < endMs && timestamp <= nowMs) {
        tokens += event.totalTokens;
      }
    }
    return { date: localDate(start), tokens };
  });

  return { day: summarize(dayStart, 1), week: summarize(weekStart, 7), trend };
}
