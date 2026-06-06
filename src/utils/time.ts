export function nowIso(): string {
  return new Date().toISOString();
}

export function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date)) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

export function localDayBucket(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function localMonthBucket(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function localHourBucket(iso: string): string {
  const date = new Date(iso);
  return `${localDayBucket(iso)} ${pad(date.getHours())}:00`;
}

export function localMinuteBucket(iso: string): string {
  const date = new Date(iso);
  return `${localDayBucket(iso)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
