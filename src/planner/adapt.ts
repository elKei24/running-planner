import { WEEKDAY_NAMES, weekday } from '@/domain/dates';
import type { LocalDate } from '@/domain/dates';
import type { Session, Units } from '@/domain/types';
import { fmtKm } from './template';

/** A run on a rest day counts as the week's long run from this share of its distance. */
export const LONG_RUN_MATCH = 0.8;
/** A moved long run or quality session keeps this many days from other hard sessions. */
export const KEY_SESSION_GAP_DAYS = 2;
/** Two long runs (or a long run and a race) are never closer than this. */
export const LONG_RUN_GAP_DAYS = 3;
/** No long run or quality session is moved into the last days before a race. */
export const RACE_LEAD_DAYS = 4;

type Hard = 'long' | 'quality' | 'race';

function hardKind(s: Session): Hard | undefined {
  if (s.type === 'race') return 'race';
  if (s.type === 'long') return 'long';
  if (s.type === 'tempo' || s.type === 'intervals' || s.type === 'marathonPace') return 'quality';
  return undefined;
}

const isRun = (s: Session) => s.type !== 'rest' && s.distanceKm > 0;
const isEasyRun = (s: Session) => (s.type === 'easy' || s.type === 'recovery') && s.distanceKm > 0;
const dayName = (s: Session) => WEEKDAY_NAMES[weekday(s.date)];

function rest(s: Session, description: string): Session {
  return { id: `${s.date}-rest`, date: s.date, type: 'rest', distanceKm: 0, title: 'Rest', description, phase: s.phase, adjusted: true };
}

/**
 * Fit the current week to what has been logged so far (ADR 0019).
 *
 * `sessions` is the week as planned, Monday first. `logged` holds the days that
 * are settled, with the distance run on each (0 = no run): every day before
 * today, and today once it has a log entry. `open` are the dates a run may be
 * placed on (available, not blocked). `nextWeek` is only read, for spacing.
 *
 * The settled days are replayed in order, each against the plan as it stood
 * that morning, so following the adjusted plan never changes it again:
 *
 * - A run on a planned run day counts as that session, whatever its distance.
 * - A run on a rest day makes up for a session missed earlier (the long run if
 *   it was long enough); otherwise it replaces the next easy run.
 * - A missed long run or quality session moves to a later day when the spacing
 *   allows; a missed easy run is dropped.
 *
 * When the log matches the plan the same array is returned, untouched.
 */
export function adaptWeek(sessions: Session[], logged: Map<LocalDate, number>, open: Set<LocalDate>, nextWeek: Session[] = [], units: Units = 'km'): Session[] {
  const out = [...sessions];
  let changed = false;
  const set = (i: number, s: Session) => {
    out[i] = s;
    changed = true;
  };
  /** Hard sessions actually run, by weekday index. */
  const done = new Map<number, Hard>();
  /** Missed sessions that found no new day; they stay on show as planned. */
  let dropped: number[] = [];

  /** Where the hard sessions are, seen from day `i`: the ones done, the ones ahead, and next week's (index 7..). */
  const hardFrom = (i: number) => {
    const hard = new Map(done);
    out.forEach((s, p) => {
      const kind = hardKind(s);
      if (p > i && kind) hard.set(p, kind);
    });
    nextWeek.forEach((s, p) => {
      const kind = hardKind(s);
      if (kind) hard.set(7 + p, kind);
    });
    return hard;
  };

  /** A later day for the missed key session at `i`: a free day first, then in place of an easy run. */
  const newDay = (i: number, isLong: boolean): number | undefined => {
    const hard = hardFrom(i);
    const fits = (t: number, gap: number) => {
      // Not after a race this week, and not in the days leading into one.
      if (out.some((x, p) => x.type === 'race' && p < t)) return false;
      for (const [p, kind] of hard) {
        const d = Math.abs(p - t);
        if (kind === 'race' && p > t && d < RACE_LEAD_DAYS) return false;
        if (isLong && kind !== 'quality' ? d < LONG_RUN_GAP_DAYS : d < gap) return false;
      }
      return true;
    };
    const candidates = out.map((_, t) => t).filter((t) => t > i && open.has(out[t]!.date) && !out[t]!.adjusted && (out[t]!.type === 'rest' || isEasyRun(out[t]!)));
    const ordered = [...candidates.filter((t) => out[t]!.type === 'rest'), ...candidates.filter((t) => out[t]!.type !== 'rest')];
    // Only the long run may end up next to a quality session.
    for (const gap of isLong ? [KEY_SESSION_GAP_DAYS, 1] : [KEY_SESSION_GAP_DAYS]) {
      const target = ordered.find((t) => fits(t, gap));
      if (target !== undefined) return target;
    }
    return undefined;
  };

  for (let i = 0; i < out.length; i++) {
    const s = out[i]!;
    const km = logged.get(s.date);
    if (km === undefined) continue; // not settled: a day ahead, or today without an entry

    if (km > 0 && isRun(s)) {
      const kind = hardKind(s);
      if (kind) done.set(i, kind);
      continue;
    }

    if (km > 0) {
      // A run on a rest day.
      let why = 'Extra run on top of the plan.';
      const long = out.findIndex((x, p) => x.type === 'long' && (p > i || dropped.includes(p)));
      const shifted = dropped.filter((p) => out[p]!.type !== 'long').at(-1);
      const nextEasy = out.findIndex((x, p) => p > i && isEasyRun(x));
      if (long >= 0 && km >= LONG_RUN_MATCH * out[long]!.distanceKm) {
        set(long, rest(out[long]!, long < i ? `Done on ${dayName(s)} instead.` : `Long run already done on ${dayName(s)}.`));
        dropped = dropped.filter((p) => p !== long);
        done.set(i, 'long');
        why = "Counts as this week's long run.";
      } else if (shifted !== undefined) {
        const m = out[shifted]!;
        const kind = hardKind(m);
        if (kind) done.set(i, kind);
        set(shifted, rest(m, `Done on ${dayName(s)} instead.`));
        dropped = dropped.filter((p) => p !== shifted);
        why = `Counts for ${m.title}, planned on ${dayName(m)}.`;
      } else if (nextEasy >= 0) {
        const e = out[nextEasy]!;
        set(nextEasy, rest(e, `Not needed: you already ran on ${dayName(s)}.`));
        why = `Extra run. It replaces ${e.title} on ${dayName(e)}.`;
      }
      set(i, { id: `${s.date}-easy`, date: s.date, type: 'easy', distanceKm: km, title: `Ran ${fmtKm(Math.round(km * 10) / 10, units)}`, description: why, phase: s.phase, adjusted: true });
      continue;
    }

    if (!isRun(s) || s.type === 'race') continue;
    // A missed run.
    const kind = hardKind(s);
    const target = kind ? newDay(i, kind === 'long') : undefined;
    if (target === undefined) {
      dropped.push(i);
      continue;
    }
    const to = out[target]!;
    set(target, { ...s, id: `${to.date}-${s.type}`, date: to.date, description: `${s.description.replace(/ Moved from \w+\.$/, '')} Moved from ${dayName(s)}.`, adjusted: true });
    set(i, rest(s, `Missed. ${s.title} moved to ${dayName(to)}.`));
  }

  return changed ? out : sessions;
}
