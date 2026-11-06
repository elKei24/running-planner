import { addDays, startOfWeek } from '@/domain/dates';
import type { LocalDate } from '@/domain/dates';
import type { Goal, PaceZones, RaceEvent, Session, Units } from '@/domain/types';
import { racePace } from './paces';
import { fmtKm } from './template';

export type SessionMap = Map<LocalDate, Session>;

/** How many days after a race hard sessions are off the table (about 0.4 days per km). */
export function recoveryDays(distanceKm: number): number {
  return Math.min(14, Math.ceil(distanceKm * 0.4));
}

function isRun(s: Session | undefined): s is Session {
  return !!s && s.type !== 'rest' && s.distanceKm > 0;
}

function isQuality(s: Session | undefined): boolean {
  return !!s && (s.type === 'tempo' || s.type === 'intervals' || s.type === 'marathonPace');
}

function toEasy(s: Session, km: number, why: string, title?: string, units: Units = 'km'): Session {
  const d = Math.round(km * 2) / 2;
  return {
    ...s,
    id: `${s.date}-easy`,
    type: 'easy',
    distanceKm: d,
    title: title ?? `Easy run ${fmtKm(d, units)}`,
    description: `${why} Conversational pace.`,
    adjusted: true,
  };
}

/** Overlay tune-up races onto the generated sessions (mutates the map). */
export function applyRaces(sessions: SessionMap, races: RaceEvent[], notBefore: LocalDate, paces?: PaceZones, units: Units = 'km'): void {
  const sorted = [...races].sort((a, b) => (a.date < b.date ? -1 : 1));
  const get = (date: LocalDate) => (date < notBefore ? undefined : sessions.get(date));
  const easy = (s: Session, km: number, why: string, title?: string) => toEasy(s, km, why, title, units);
  for (const race of sorted) {
    const existing = get(race.date);
    if (!existing) continue; // outside the plan window
    const label = race.name ?? `${formatKm(race.distanceKm, units)} race`;
    const pace = paces ? racePace(paces.vdot, race.distanceKm) : undefined;
    sessions.set(race.date, {
      id: `${race.date}-race`,
      date: race.date,
      type: 'race',
      distanceKm: race.distanceKm,
      title: label,
      description:
        race.priority === 'B'
          ? 'Tune-up race. Race it honestly, but it is a rehearsal, not the goal.'
          : 'Low-key race: treat it as the week\'s hard workout. Warm up and cool down 1–2 km.',
      phase: existing.phase,
      raceEventId: race.id,
      adjusted: true,
      ...(pace ? { pace } : {}),
    });

    if (race.priority === 'B') {
      // Mini taper: three easier days before.
      const dayBefore = get(addDays(race.date, -1));
      if (isRun(dayBefore)) {
        sessions.set(dayBefore.date, easy(dayBefore, Math.min(dayBefore.distanceKm, 4), 'Shakeout before tomorrow\'s race.', 'Shakeout jog'));
      }
      for (const back of [2, 3]) {
        const s = get(addDays(race.date, -back));
        if (!isRun(s)) continue;
        if (isQuality(s) || s.type === 'long') {
          sessions.set(s.date, easy(s, s.distanceKm * (back === 2 ? 0.6 : 0.7), 'Easy ahead of the race.'));
        }
      }
    } else {
      const dayBefore = get(addDays(race.date, -1));
      if (dayBefore && isQuality(dayBefore)) {
        sessions.set(dayBefore.date, easy(dayBefore, dayBefore.distanceKm, 'Easy before tomorrow\'s race.'));
      }
    }

    // Recovery after.
    const window = race.priority === 'B' ? recoveryDays(race.distanceKm) : 1;
    for (let k = 1; k <= window; k++) {
      const s = get(addDays(race.date, k));
      if (!isRun(s)) continue;
      if (k === 1) {
        sessions.set(s.date, {
          ...easy(s, Math.min(s.distanceKm, 6), 'Recovery after the race.', 'Recovery jog'),
          id: `${s.date}-recovery`,
          type: 'recovery',
        });
      } else if (k <= 2 && s.type === 'long') {
        sessions.set(s.date, easy(s, s.distanceKm * 0.5, 'Shortened after the race.'));
      } else if (isQuality(s)) {
        sessions.set(s.date, easy(s, s.distanceKm, 'Still recovering from the race: no hard running.'));
      } else if (s.type === 'long') {
        sessions.set(s.date, { ...s, description: 'Easy only, still recovering from the race. No marathon-pace work.', adjusted: true });
      }
    }
  }
}

/** Pattern of the final six days before the goal race, as fraction of the race-week budget. */
const RACE_WEEK_PATTERN: Array<{ back: number; fraction: number; type: Session['type']; title: string; description: string }> = [
  { back: 1, fraction: 0.12, type: 'easy', title: 'Shakeout jog', description: '15–20 minutes very easy with 4 relaxed strides. Lay out your kit.' },
  { back: 2, fraction: 0, type: 'rest', title: 'Rest', description: 'Off your feet as much as possible. Carb-load starts now.' },
  { back: 3, fraction: 0.22, type: 'easy', title: 'Easy run', description: 'Short and relaxed. Nothing to gain, plenty to lose.' },
  { back: 4, fraction: 0.28, type: 'marathonPace', title: 'Race-pace tune-up', description: '2 km warm-up · 3 × 1 km at marathon pace with 1 min jog · 1 km cool-down. Rehearse race-day breakfast and gels.' },
  { back: 5, fraction: 0.2, type: 'easy', title: 'Easy run', description: 'Conversational pace.' },
  { back: 6, fraction: 0.18, type: 'easy', title: 'Easy run', description: 'Conversational pace.' },
];

/** Overlay the goal race and the final pre-race days (mutates the map). */
export function applyGoalRace(
  sessions: SessionMap,
  goal: Goal,
  raceWeekBudgetKm: number,
  daysPerWeek: number,
  blocked: Set<LocalDate>,
  notBefore: LocalDate,
  paces?: PaceZones,
  units: Units = 'km',
): void {
  const raceDay = sessions.get(goal.date);
  if (!raceDay) return;
  const targetPace = goal.targetTimeSec ? goal.targetTimeSec / goal.distanceKm : undefined;
  const pace = targetPace
    ? { minSecPerKm: Math.round(targetPace * 0.98), maxSecPerKm: Math.round(targetPace * 1.02) }
    : paces
      ? racePace(paces.vdot, goal.distanceKm)
      : undefined;
  sessions.set(goal.date, {
    id: `${goal.date}-race`,
    date: goal.date,
    type: 'race',
    distanceKm: goal.distanceKm,
    title: goal.name ? `Race day: ${goal.name}` : 'Race day',
    description: 'Start conservatively: the first 10 km should feel too easy. Fuel early and often. Enjoy it, you earned this.',
    phase: 'taper',
    raceEventId: 'goal',
    adjusted: true,
    ...(pace ? { pace } : {}),
  });

  for (const p of RACE_WEEK_PATTERN) {
    const date = addDays(goal.date, -p.back);
    const existing = sessions.get(date);
    if (!existing || blocked.has(date) || date < notBefore) continue;
    const dropped = daysPerWeek <= 3 ? [5, 6] : daysPerWeek <= 4 ? [5] : [];
    if (dropped.includes(p.back)) {
      sessions.set(date, { ...existing, id: `${date}-rest`, type: 'rest', distanceKm: 0, title: 'Rest', description: 'Rest.', pace: undefined, adjusted: true });
      continue;
    }
    const km = Math.round(Math.max(p.type === 'rest' ? 0 : p.type === 'marathonPace' ? 6 : 3, raceWeekBudgetKm * p.fraction) * 2) / 2;
    const session: Session = {
      id: `${date}-${p.type}`,
      date,
      type: p.type,
      distanceKm: p.type === 'rest' ? 0 : km,
      title: p.type === 'rest' ? p.title : `${p.title} ${fmtKm(km, units)}`,
      description: p.description,
      phase: 'taper',
      adjusted: true,
    };
    const sp = sessionPace(p.type, paces, pace);
    if (sp) session.pace = sp;
    sessions.set(date, session);
  }

  // The pattern may push the calendar week(s) it touches over the athlete's
  // run-day budget when the race is mid-week. Drop the least valuable
  // non-pattern runs (easy first, then quality, then long) until it fits.
  const patternDates = new Set(RACE_WEEK_PATTERN.map((p) => addDays(goal.date, -p.back)));
  const touchedWeeks = new Set([...patternDates].map(startOfWeek));
  const priority: Record<Session['type'], number> = { recovery: 0, easy: 1, tempo: 2, intervals: 2, marathonPace: 2, long: 3, race: 4, rest: 5 };
  for (const weekStart of touchedWeeks) {
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const candidates = days
      .map((d) => sessions.get(d))
      .filter((s): s is Session => !!s && isRun(s) && !patternDates.has(s.date) && s.date < goal.date)
      .sort((a, b) => priority[a.type] - priority[b.type]);
    let runs = days.filter((d) => isRun(sessions.get(d))).length;
    for (const s of candidates) {
      if (runs <= daysPerWeek) break;
      sessions.set(s.date, { ...s, id: `${s.date}-rest`, type: 'rest', distanceKm: 0, title: 'Rest', description: 'Extra rest ahead of race week.', pace: undefined, adjusted: true });
      runs--;
    }
  }

  // Days after the goal race inside the plan window: recovery.
  for (let k = 1; k <= 7; k++) {
    const date = addDays(goal.date, k);
    const s = sessions.get(date);
    if (!s) break;
    sessions.set(date, { ...s, id: `${date}-rest`, type: 'rest', distanceKm: 0, title: 'Recovery', description: 'Walk, eat, sleep. Running resumes when the legs ask for it.', pace: undefined, adjusted: true });
  }
}

function sessionPace(type: Session['type'], paces: PaceZones | undefined, goalPace: Session['pace']) {
  if (type === 'marathonPace') return goalPace ?? paces?.marathon;
  if (type === 'easy') return paces?.easy;
  return undefined;
}

function formatKm(km: number, units: Units): string {
  if (Math.abs(km - 42.195) < 0.01) return 'Marathon';
  if (Math.abs(km - 21.0975) < 0.01) return 'Half marathon';
  return fmtKm(km, units);
}
