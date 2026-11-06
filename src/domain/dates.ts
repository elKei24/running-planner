/**
 * Calendar-date helpers. All dates in the app are "local dates" encoded as
 * ISO strings ("YYYY-MM-DD") and never timestamps, so that a training day is
 * the same day regardless of the device's timezone.
 */
export type LocalDate = string;

/** Monday = 0 ... Sunday = 6. Training weeks start on Monday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const WEEKDAY_LONG_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== 'string') return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  return (
    date.getUTCFullYear() === Number(y) &&
    date.getUTCMonth() === Number(mo) - 1 &&
    date.getUTCDate() === Number(d)
  );
}

function toUtc(date: LocalDate): Date {
  const m = DATE_RE.exec(date);
  if (!m) throw new Error(`Invalid local date: ${date}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function fromUtc(date: Date): LocalDate {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Today's date in the device's local timezone. */
export function today(now: Date = new Date()): LocalDate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** Number of days from `a` to `b` (positive when b is after a). */
export function diffDays(a: LocalDate, b: LocalDate): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000);
}

export function weekday(date: LocalDate): Weekday {
  // JS: Sunday = 0; we want Monday = 0.
  return (((toUtc(date).getUTCDay() + 6) % 7) as Weekday);
}

/** The Monday of the week containing `date`. */
export function startOfWeek(date: LocalDate): LocalDate {
  return addDays(date, -weekday(date));
}

export function compareDates(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function maxDate(a: LocalDate, b: LocalDate): LocalDate {
  return a > b ? a : b;
}

export function minDate(a: LocalDate, b: LocalDate): LocalDate {
  return a < b ? a : b;
}

export function isBetween(date: LocalDate, from: LocalDate, to: LocalDate): boolean {
  return date >= from && date <= to;
}

/** Inclusive list of dates from `from` to `to`. */
export function dateRange(from: LocalDate, to: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Number of Monday-starting weeks from the week of `from` to the week of `to`, inclusive. */
export function weeksBetween(from: LocalDate, to: LocalDate): number {
  return Math.floor(diffDays(startOfWeek(from), startOfWeek(to)) / 7) + 1;
}

export function formatDate(date: LocalDate, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const d = toUtc(date);
  const parts: string[] = [];
  if (opts.weekday) parts.push(WEEKDAY_NAMES[weekday(date)]);
  parts.push(`${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`);
  if (opts.year) parts.push(String(d.getUTCFullYear()));
  return parts.join(' ');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
