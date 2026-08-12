import { z } from 'zod';

const strictIsoInstantSchema = z
  .string()
  .datetime({ offset: true })
  .superRefine((value, ctx) => {
    const parts = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2})(?::([0-9]{2}))?/.exec(
      value
    );
    if (parts === null) return;
    const [, yearText, monthText, dayText, hourText, minuteText, secondText] = parts;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const hour = Number(hourText);
    const minute = Number(minuteText);
    const second = Number(secondText ?? '0');
    const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > daysInMonth[month - 1] ||
      hour > 23 ||
      minute > 59 ||
      second > 59 ||
      !Number.isFinite(new Date(value).getTime())
    ) {
      ctx.addIssue({ code: 'custom', message: 'invalid_report_option' });
    }
  });

export function isStrictIsoInstant(value: string): boolean {
  return strictIsoInstantSchema.safeParse(value).success;
}

export function parseStrictIsoInstant(value: string): number {
  const parsed = strictIsoInstantSchema.safeParse(value);
  if (!parsed.success) throw new Error('invalid_report_option');
  return new Date(parsed.data).getTime();
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
