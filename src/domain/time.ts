export interface ZoneParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  weekday: string;
  isoDate: string;
}

export function partsInZone(date: Date, timeZone: string): ZoneParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });
  const bag = Object.fromEntries(fmt.formatToParts(date).map((part) => [part.type, part.value]));
  let hour = bag.hour ?? '00';
  if (hour === '24') hour = '00';
  hour = hour.padStart(2, '0');
  const minute = (bag.minute ?? '00').padStart(2, '0');
  const year = bag.year;
  const month = bag.month;
  const day = bag.day;
  return {
    year,
    month,
    day,
    hour,
    minute,
    weekday: bag.weekday ?? '',
    isoDate: `${year}-${month}-${day}`,
  };
}

export function todayInZone(timeZone: string, now: Date): string {
  return partsInZone(now, timeZone).isoDate;
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

export function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

export function weekdayIndex(isoDate: string, timeZone: string): number {
  const noon = new Date(`${isoDate}T12:00:00Z`);
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(noon);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
}

export function zonedLocalToUtc(isoDate: string, hhmm: string, timeZone: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const [hour, minute] = hhmm.split(':').map(Number);
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let pass = 0; pass < 3; pass += 1) {
    const parts = partsInZone(new Date(utc), timeZone);
    const got = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    const want = Date.UTC(year, month - 1, day, hour, minute);
    utc += want - got;
  }
  return new Date(utc).toISOString();
}

export function minutesOfDay(hhmm: string): number {
  const [hour, minute] = hhmm.split(':').map(Number);
  return hour * 60 + minute;
}

export function greeting(now: Date, timeZone: string): string {
  const hour = Number(partsInZone(now, timeZone).hour);
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function formatDateShort(isoDate: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

export function formatDateLong(isoDate: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

export function formatTimestamp(iso: string, timeZone: string): string {
  const parts = partsInZone(new Date(iso), timeZone);
  return `${parts.hour}:${parts.minute}`;
}

export function formatMilitary(hhmm: string): string {
  return hhmm.replace(':', '');
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  const hourLabel = hours === 1 ? '1 hour' : `${hours} hours`;
  if (remainder === 0) return hourLabel;
  const minuteLabel = remainder === 1 ? '1 minute' : `${remainder} minutes`;
  if (hours === 0) return minuteLabel;
  return `${hourLabel} ${minuteLabel}`;
}

export function intervalMinutes(date: string, endDate: string, startTime: string, endTime: string, timeZone: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return null;
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) return null;
  const start = Date.parse(zonedLocalToUtc(date, startTime, timeZone));
  const end = Date.parse(zonedLocalToUtc(endDate, endTime, timeZone));
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.round((end - start) / 60000);
}
