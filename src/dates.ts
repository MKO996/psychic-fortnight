/** Dates are ISO calendar dates "YYYY-MM-DD" with no time zone. */
export type ISODate = string;

export function toISO(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): ISODate {
  return toISO(new Date());
}

function dayNum(iso: ISODate): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

function fromDayNum(n: number): ISODate {
  const d = new Date(n * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return dayNum(b) - dayNum(a);
}

export function addDays(iso: ISODate, n: number): ISODate {
  return fromDayNum(dayNum(iso) + n);
}

export function addMonths(iso: ISODate, n: number): ISODate {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return fromDayNum(Math.round(target.getTime() / 86400000));
}

export function endOfMonth(iso: ISODate): ISODate {
  const [y, m] = iso.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

export function isValidISO(s: string | null | undefined): s is ISODate {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return fromDayNum(dayNum(s)) === s;
}

const shortFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const longFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

function asUTC(iso: ISODate): Date {
  return new Date(dayNum(iso) * 86400000);
}

/** "Thu 19 Nov" */
export function shortDate(iso: ISODate): string {
  return shortFmt.format(asUTC(iso));
}

/** "Thursday 19 November" */
export function longDate(iso: ISODate): string {
  return longFmt.format(asUTC(iso));
}

/** "today", "tomorrow", "in 3 days", "2 days ago" */
export function relativeDay(iso: ISODate, today: ISODate): string {
  const n = daysBetween(today, iso);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  if (n > 1) return `in ${n} days`;
  return `${-n} days ago`;
}
