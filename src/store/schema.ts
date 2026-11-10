import { isLocalDate } from '@/domain/dates';
import type { Weekday } from '@/domain/dates';
import { SCHEMA_VERSION } from '@/domain/types';
import { MAX_MAX_HR, MIN_MAX_HR } from '@/domain/heartRate';
import type { Athlete, AvailabilityEvent, Goal, LogEntry, PlanEvent, PlannerState, Prefs } from '@/domain/types';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function fail(path: string, expected: string): never {
  throw new ValidationError(`${path}: expected ${expected}`);
}

function obj(v: unknown, path: string): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(path, 'an object');
  return v as Record<string, unknown>;
}

function num(v: unknown, path: string, min = -Infinity, max = Infinity): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) fail(path, `a number in [${min}, ${max}]`);
  return v;
}

function optNum(v: unknown, path: string, min?: number, max?: number): number | undefined {
  return v === undefined || v === null ? undefined : num(v, path, min, max);
}

function str(v: unknown, path: string): string {
  if (typeof v !== 'string') fail(path, 'a string');
  return v;
}

function optStr(v: unknown, path: string): string | undefined {
  return v === undefined || v === null ? undefined : str(v, path);
}

function date(v: unknown, path: string): string {
  if (!isLocalDate(v)) fail(path, 'a YYYY-MM-DD date');
  return v;
}

function weekday(v: unknown, path: string): Weekday {
  return num(v, path, 0, 6) as Weekday;
}

export function validateAthlete(v: unknown, path = 'athlete'): Athlete {
  const o = obj(v, path);
  const athlete: Athlete = {
    weeklyKmRecent: num(o.weeklyKmRecent, `${path}.weeklyKmRecent`, 0, 400),
    longestRecentRunKm: num(o.longestRecentRunKm, `${path}.longestRecentRunKm`, 0, 100),
    daysPerWeek: Math.round(num(o.daysPerWeek, `${path}.daysPerWeek`, 1, 7)),
    longRunDay: weekday(o.longRunDay, `${path}.longRunDay`),
    peakWeeklyKm: num(o.peakWeeklyKm, `${path}.peakWeeklyKm`, 0, 400),
  };
  if (o.buildStrategy !== undefined && o.buildStrategy !== null) {
    if (o.buildStrategy !== 'steady' && o.buildStrategy !== 'fast') fail(`${path}.buildStrategy`, "'steady' or 'fast'");
    athlete.buildStrategy = o.buildStrategy;
  }
  if (o.maxHr !== undefined && o.maxHr !== null) {
    athlete.maxHr = Math.round(num(o.maxHr, `${path}.maxHr`, MIN_MAX_HR, MAX_MAX_HR));
  }
  if (o.referenceRace !== undefined && o.referenceRace !== null) {
    const r = obj(o.referenceRace, `${path}.referenceRace`);
    athlete.referenceRace = {
      distanceKm: num(r.distanceKm, `${path}.referenceRace.distanceKm`, 0.5, 200),
      timeSec: num(r.timeSec, `${path}.referenceRace.timeSec`, 60, 48 * 3600),
    };
  }
  return athlete;
}

export function validateGoal(v: unknown, path = 'goal'): Goal {
  const o = obj(v, path);
  const goal: Goal = {
    date: date(o.date, `${path}.date`),
    distanceKm: num(o.distanceKm, `${path}.distanceKm`, 1, 200),
  };
  const target = optNum(o.targetTimeSec, `${path}.targetTimeSec`, 60, 48 * 3600);
  if (target !== undefined) goal.targetTimeSec = target;
  const name = optStr(o.name, `${path}.name`);
  if (name) goal.name = name;
  return goal;
}

export function validateEvent(v: unknown, path: string): PlanEvent {
  const o = obj(v, path);
  const id = str(o.id, `${path}.id`);
  switch (o.kind) {
    case 'race': {
      const priority = o.priority === 'B' || o.priority === 'C' ? o.priority : fail(`${path}.priority`, "'B' or 'C'");
      const e: PlanEvent = { id, kind: 'race', date: date(o.date, `${path}.date`), distanceKm: num(o.distanceKm, `${path}.distanceKm`, 0.5, 200), priority };
      const name = optStr(o.name, `${path}.name`);
      if (name) e.name = name;
      return e;
    }
    case 'block': {
      const reasons = ['vacation', 'injury', 'illness', 'other'] as const;
      const reason = reasons.find((r) => r === o.reason) ?? fail(`${path}.reason`, reasons.join('|'));
      const from = date(o.from, `${path}.from`);
      const to = date(o.to, `${path}.to`);
      if (to < from) fail(`${path}.to`, 'a date on or after from');
      const e: PlanEvent = { id, kind: 'block', from, to, reason };
      const note = optStr(o.note, `${path}.note`);
      if (note) e.note = note;
      return e;
    }
    case 'availability': {
      if (!Array.isArray(o.days)) fail(`${path}.days`, 'an array of weekdays');
      const days = [...new Set(o.days.map((d, i) => weekday(d, `${path}.days[${i}]`)))].sort((a, b) => a - b);
      const e: AvailabilityEvent = { id, kind: 'availability', weekOf: date(o.weekOf, `${path}.weekOf`), days };
      if (o.replanFrom !== undefined && o.replanFrom !== null) e.replanFrom = date(o.replanFrom, `${path}.replanFrom`);
      return e;
    }
    default:
      return fail(`${path}.kind`, "'race', 'block' or 'availability'");
  }
}

export function validateLogEntry(v: unknown, path: string): LogEntry {
  const o = obj(v, path);
  const entry: LogEntry = {
    id: str(o.id, `${path}.id`),
    date: date(o.date, `${path}.date`),
    distanceKm: num(o.distanceKm, `${path}.distanceKm`, 0, 400),
  };
  const duration = optNum(o.durationSec, `${path}.durationSec`, 0, 48 * 3600);
  if (duration !== undefined) entry.durationSec = duration;
  const rpe = optNum(o.rpe, `${path}.rpe`, 1, 10);
  if (rpe !== undefined) entry.rpe = rpe;
  const note = optStr(o.note, `${path}.note`);
  if (note) entry.note = note;
  if (o.skipped === true) entry.skipped = true;
  return entry;
}

export function validatePrefs(v: unknown, path = 'prefs'): Prefs {
  const o = obj(v, path);
  if (o.units !== 'km' && o.units !== 'mi') fail(`${path}.units`, "'km' or 'mi'");
  return { units: o.units };
}

/** Validate an untrusted value (from localStorage or an imported file) into a PlannerState. */
export function validateState(v: unknown): PlannerState {
  const o = obj(v, 'state');
  const version = num(o.version, 'version', 1, SCHEMA_VERSION);
  if (version !== SCHEMA_VERSION) fail('version', `schema version ${SCHEMA_VERSION} (run migrations first)`);
  if (!Array.isArray(o.events)) fail('events', 'an array');
  if (!Array.isArray(o.log)) fail('log', 'an array');
  const state: PlannerState = {
    version,
    createdAt: date(o.createdAt, 'createdAt'),
    athlete: validateAthlete(o.athlete),
    goal: validateGoal(o.goal),
    events: o.events.map((e, i) => validateEvent(e, `events[${i}]`)),
    log: o.log.map((e, i) => validateLogEntry(e, `log[${i}]`)),
    prefs: validatePrefs(o.prefs),
  };
  if (o.baselineDate !== undefined && o.baselineDate !== null) state.baselineDate = date(o.baselineDate, 'baselineDate');
  const ids = new Set<string>();
  for (const e of [...state.events, ...state.log]) {
    if (ids.has(e.id)) fail('ids', `unique ids (duplicate ${e.id})`);
    ids.add(e.id);
  }
  return state;
}
