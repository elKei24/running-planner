import { addDays, WEEKDAY_NAMES } from '@/domain/dates';
import type { LocalDate, Weekday } from '@/domain/dates';
import type { PaceRange, PaceZones, Phase, Session, SessionType, Units } from '@/domain/types';

const KM_PER_MILE = 1.609344;

/** Format a km value for titles/descriptions in the athlete's units. */
export function fmtKm(km: number, units: Units = 'km'): string {
  if (units === 'mi') {
    const mi = Math.round((km / KM_PER_MILE) * 10) / 10;
    return `${Number.isInteger(mi) ? mi : mi.toFixed(1)} mi`;
  }
  return `${Number.isInteger(km) ? km : km.toFixed(1).replace(/\.0$/, '')} km`;
}

export const MAX_LONG_RUN_KM = 35;
/** Marathon-specific target for peak-phase long runs (ADR 0013). */
export const MARATHON_LONG_RUN_TARGET_KM = 32;
export const MARATHON_LONG_RUN_FIRST_KM = 28;
/** A long run should never be more than half the week. */
export const MAX_LONG_RUN_SHARE = 0.5;
/** ...unless the athlete demonstrably already runs it: then up to 60 % of the week. */
export const MAX_ESTABLISHED_LONG_RUN_SHARE = 0.6;

/**
 * The long run never regresses below what the athlete already does: the
 * recent longest run (declared at setup, then taken from the log), limited to
 * 60 % of the week so that step-back, blocked and post-layoff weeks still shrink it.
 */
export function establishedLongRunFloor(recentLongestKm: number, weekKm: number): number {
  return Math.max(0, Math.min(recentLongestKm, weekKm * MAX_ESTABLISHED_LONG_RUN_SHARE));
}

/**
 * Floor for a long run when training for a marathon, limited to half the week:
 * - peak phase: 28 → 30 → 32 km across the phase;
 * - the build phase right before the peak (`finalBuild`): 22 km + 1 km per week,
 *   so the long run walks up to the peak instead of dipping after a maintain phase.
 * Returns 0 for shorter goals or other phases.
 */
export function marathonLongRunFloor(goalKm: number, phase: Phase, weekKm: number, phaseOrdinal = 0, finalBuild = false): number {
  if (goalKm <= 40) return 0;
  if (phase === 'peak') {
    const progressed = Math.min(MARATHON_LONG_RUN_TARGET_KM, MARATHON_LONG_RUN_FIRST_KM + 2 * phaseOrdinal);
    return Math.min(progressed, weekKm * MAX_LONG_RUN_SHARE);
  }
  if (phase === 'build' && finalBuild) {
    return Math.min(MARATHON_LONG_RUN_FIRST_KM - 6 + phaseOrdinal, MARATHON_LONG_RUN_FIRST_KM - 1, weekKm * MAX_LONG_RUN_SHARE);
  }
  return 0;
}

/** Every third maintain week carries a longer long run (+15 %), still within half the week. */
export function maintainLongRunBoost(phase: Phase, weekKm: number, phaseOrdinal: number): number {
  if (phase !== 'maintain' || phaseOrdinal % 3 !== 2) return 0;
  return Math.min(weekKm * longRunFraction('maintain', weekKm) * 1.15, weekKm * MAX_LONG_RUN_SHARE);
}

/** Longest run a peak week of `weekKm` implies for a goal of `goalKm` (before time/growth caps). */
export function peakLongRunKm(weekKm: number, goalKm: number): number {
  const share = weekKm * longRunFraction('peak', weekKm);
  const floor = marathonLongRunFloor(goalKm, 'peak', weekKm, 2);
  return Math.round(Math.min(MAX_LONG_RUN_KM, Math.max(share, floor)) * 2) / 2;
}
export const MIN_EASY_RUN_KM = 4;
export const MIN_QUALITY_RUN_KM = 5;
export const MIN_WEEK_FOR_QUALITY_KM = 15;

export interface WeekTemplateInput {
  index: number;
  startDate: LocalDate;
  phase: Phase;
  targetKm: number;
  isStepBack: boolean;
  isRaceWeek: boolean;
  daysPerWeek: number;
  longRunDay: Weekday;
  /** Days the athlete can run this week (after availability overrides). */
  availableDays: Weekday[];
  /** Dates in this week that are blocked, with the reason. */
  blockedDates: Map<LocalDate, string>;
  /** Maximum long run length this week. */
  longCapKm: number;
  /** Minimum long run length this week (marathon floor), 0 when none. */
  longFloorKm?: number;
  paces?: PaceZones;
  /** Days before this date are not planned. */
  createdAt: LocalDate;
  /** Position of this week within its phase (0 = first week of the phase). */
  phaseOrdinal?: number;
  /** Number of weeks in this week's phase. */
  phaseLength?: number;
  /** Return-to-running: no quality sessions this week. */
  easyOnly?: boolean;
  units?: Units;
}

export type QualityKind = 'tempo' | 'intervals' | 'marathonPace';

/** Which quality sessions a week gets, by phase. Parity alternates stimulus week to week. */
export function qualityKinds(phase: Phase, index: number, daysPerWeek: number, isStepBack: boolean, phaseOrdinal = 0, phaseLength = 1): QualityKind[] {
  const odd = index % 2 === 1;
  switch (phase) {
    case 'base':
      return ['tempo'];
    case 'build':
    case 'maintain': {
      const kinds: QualityKind[] = odd ? ['intervals', 'tempo'] : ['tempo', 'intervals'];
      return daysPerWeek >= 5 && !isStepBack ? kinds : kinds.slice(0, 1);
    }
    case 'peak': {
      const kinds: QualityKind[] = odd ? ['tempo', 'marathonPace'] : ['marathonPace', 'tempo'];
      return daysPerWeek >= 5 && !isStepBack ? kinds : kinds.slice(0, 1);
    }
    case 'taper':
      // Keep some VO2max stimulus in the first taper week when there is more than one; sharpen with tempo after.
      return phaseLength >= 2 && phaseOrdinal === 0 ? ['intervals'] : ['tempo'];
  }
}

/**
 * Share of the weekly volume that goes into the long run. Lower-volume runners
 * need a proportionally bigger long run (Higdon-style 60 km weeks carry 30 km
 * long runs), high-volume runners a smaller one (Pfitzinger 90 km → 32 km).
 * Linear from 45 % at 40 km/week to 33 % at 100 km/week, then scaled by phase.
 */
export function longRunFraction(phase: Phase, weekKm = 60): number {
  const peakFraction = Math.min(0.45, Math.max(0.3, 0.45 - (weekKm - 40) * 0.002));
  switch (phase) {
    case 'base':
      return peakFraction * 0.8;
    case 'build':
      return peakFraction * 0.9;
    case 'maintain':
      return peakFraction * 0.95;
    case 'peak':
      return peakFraction;
    case 'taper':
      return peakFraction * 0.8;
  }
}

export function paceFor(type: SessionType, paces?: PaceZones): PaceRange | undefined {
  if (!paces) return undefined;
  switch (type) {
    case 'easy':
    case 'long':
      return paces.easy;
    case 'recovery':
      return { minSecPerKm: paces.easy.maxSecPerKm - 15, maxSecPerKm: paces.easy.maxSecPerKm + 30 };
    case 'tempo':
      return paces.threshold;
    case 'intervals':
      return paces.interval;
    case 'marathonPace':
    case 'race':
      return paces.marathon;
    case 'rest':
      return undefined;
  }
}

export function roundHalf(km: number): number {
  return Math.round(km * 2) / 2;
}

function circularDistance(a: Weekday, b: Weekday): number {
  const d = Math.abs(a - b);
  return Math.min(d, 7 - d);
}

/** All ways to pick `k` of `items`, each in the order given, earliest picks first. */
function combinations<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  return items.flatMap((item, i) => combinations(items.slice(i + 1), k - 1).map((rest) => [item, ...rest]));
}

/** Compare two lists of numbers entry by entry: negative when `a` comes first. */
function compareLists(a: number[], b: number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i]! - b[i]!;
  }
  return a.length - b.length;
}

/** The most room a hard session can use: three days clear of the long run on both sides. */
export const FULL_ROOM_DAYS = 3;

/**
 * Pick which weekdays are run days and which roles they play.
 *
 * The long run goes on the preferred day, otherwise the nearest available one.
 * Every way of choosing the other run days and the quality days among them is
 * then compared, and the best layout wins:
 *
 * 1. Run days spread as evenly over the week as possible.
 * 2. As much room as possible between the hard sessions (long run and quality),
 *    counted up to three days.
 * 3. No run the day after the long run, then none the day before it.
 * 4. Otherwise the earlier days: quality sessions first, so that a missed one
 *    can still be made up later in the week, then the run days as a whole.
 *
 * Quality and easy days are returned in calendar order.
 */
export function chooseRunDays(
  longRunDay: Weekday,
  daysPerWeek: number,
  available: Weekday[],
  qualityCount: number,
): { long?: Weekday; quality: Weekday[]; easy: Weekday[] } {
  const avail = new Set(available);
  if (avail.size === 0 || daysPerWeek <= 0) return { quality: [], easy: [] };

  let long: Weekday | undefined;
  for (const delta of [0, -1, 1, -2, 2, -3, 3]) {
    const d = (((longRunDay + delta) % 7) + 7) % 7 as Weekday;
    if (avail.has(d)) {
      long = d;
      break;
    }
  }
  if (long === undefined) return { quality: [], easy: [] };
  const longDay = long;

  const candidates = ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).filter((d) => d !== longDay && avail.has(d));
  const otherCount = Math.min(daysPerWeek - 1, candidates.length);
  const wanted = Math.min(qualityCount, otherCount);
  const dayAfter = (longDay + 1) % 7;
  const dayBefore = (longDay + 6) % 7;

  let best: { score: number[]; quality: Weekday[]; others: Weekday[] } | undefined;
  for (const others of combinations(candidates, otherCount)) {
    const runDays = [...others, longDay].sort((a, b) => a - b);
    // Gaps between consecutive run days, round the week, smallest first: larger is more even.
    const gaps = runDays.map((d, i) => (runDays[(i + 1) % runDays.length]! - d + 7) % 7 || 7).sort((a, b) => a - b);
    const adjacent = [others.includes(dayAfter as Weekday) ? 0 : 1, others.includes(dayBefore as Weekday) ? 0 : 1];
    for (const quality of combinations(others, wanted)) {
      const hard = [longDay, ...quality];
      const room = Math.min(FULL_ROOM_DAYS, ...hard.flatMap((a, i) => hard.slice(i + 1).map((b) => circularDistance(a, b))));
      const score = [...gaps, room, ...adjacent];
      // Higher score wins; on a tie the earlier quality days, then the earlier run days.
      const better =
        !best ||
        compareLists(score, best.score) > 0 ||
        (compareLists(score, best.score) === 0 && (compareLists(quality, best.quality) < 0 || (compareLists(quality, best.quality) === 0 && compareLists(others, best.others) < 0)));
      if (better) best = { score, quality, others };
    }
  }
  if (!best) return { long, quality: [], easy: [] };
  const { quality, others } = best;
  return { long, quality, easy: others.filter((d) => !quality.includes(d)) };
}

export interface Distribution {
  longKm: number;
  qualityKm: number[];
  easyKm: number[];
}

/** Split the weekly volume between long run, quality sessions and easy days. */
export function distribute(
  targetKm: number,
  phase: Phase,
  longCapKm: number,
  qualityCount: number,
  easyDays: number,
  longFloorKm = 0,
): Distribution {
  const target = Math.max(0, targetKm);
  const cap = Math.min(longCapKm, MAX_LONG_RUN_KM);
  // The caller is responsible for keeping the floor a sane share of the week.
  const wanted = Math.max(target * longRunFraction(phase, target), longFloorKm);
  let longKm = Math.min(wanted, cap);
  const qFraction = phase === 'base' ? 0.15 : 0.18;
  // No other run may exceed the long-run cap: volume that cannot be placed is dropped.
  const perRunCap = Math.max(cap, MIN_QUALITY_RUN_KM);
  let qualityKm = Array<number>(qualityCount).fill(Math.min(perRunCap, Math.max(MIN_QUALITY_RUN_KM, target * qFraction)));

  let remaining = target - longKm - sum(qualityKm);
  let easyCount = easyDays;
  while (easyCount > 0 && remaining / easyCount < MIN_EASY_RUN_KM) easyCount--;

  if (remaining < 0) {
    // Tiny week (partial first week, heavy block): drop quality sessions before
    // touching the long run, which is a single-session commitment.
    while (remaining < 0 && qualityKm.length > 0) {
      qualityKm = qualityKm.slice(0, -1);
      remaining = target - longKm - sum(qualityKm);
    }
    if (remaining < 0) {
      longKm = Math.min(longKm, Math.max(target, longFloorKm));
      remaining = 0;
    }
  } else if (easyCount === 0 && remaining > 0) {
    // Nowhere to put the remainder: let the long run absorb what the cap allows.
    const extra = Math.min(remaining, cap - longKm);
    longKm += Math.max(0, extra);
    remaining -= Math.max(0, extra);
    if (qualityKm.length > 0 && remaining > 0) {
      const perQ = remaining / qualityKm.length;
      qualityKm = qualityKm.map((q) => Math.min(perRunCap, q + perQ));
    }
  }

  // The long run should be the longest run of the week. In small weeks the
  // easy remainder can exceed it; equalise within the long-run cap.
  if (easyCount > 0 && remaining / easyCount > longKm) {
    const equal = Math.min(cap, (longKm + remaining) / (easyCount + 1));
    remaining -= Math.max(0, equal - longKm);
    longKm = Math.max(longKm, equal);
  }
  const easyPer = easyCount > 0 ? Math.min(remaining / easyCount, Math.max(longKm, MIN_EASY_RUN_KM)) : 0;
  const easyKm = Array<number>(easyCount).fill(easyPer);
  return {
    longKm: roundHalf(longKm),
    qualityKm: qualityKm.map(roundHalf),
    easyKm: easyKm.map(roundHalf),
  };
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

interface QualityStructure {
  distanceKm: number;
  title: string;
  description: string;
}

export function structureQuality(kind: QualityKind, km: number, phase: Phase, units: Units = 'km'): QualityStructure {
  const wu = km >= 8 ? 2 : 1.5;
  const cd = km >= 8 ? 1.5 : 1;
  const work = Math.max(2, km - wu - cd);
  const f = (n: number) => fmtKm(n, units);
  switch (kind) {
    case 'tempo': {
      const w = roundHalf(work);
      const total = roundHalf(wu + w + cd);
      const note =
        phase === 'base'
          ? 'Comfortably hard, controlled. If in doubt, slow down.'
          : phase === 'taper'
            ? 'Short and sharp: keeps the legs tuned without fatigue.'
            : 'Threshold effort: you could say a few words, not a sentence.';
      return {
        distanceKm: total,
        title: `Tempo ${f(w)}`,
        description: `${f(wu)} warm-up · ${f(w)} at threshold pace · ${f(cd)} cool-down. ${note}`,
      };
    }
    case 'intervals': {
      const maxReps = phase === 'taper' ? 5 : 8;
      const reps = Math.max(3, Math.min(maxReps, Math.round((work + 0.4) / 1.4)));
      const total = roundHalf(wu + reps * 1.4 - 0.4 + cd);
      const note = phase === 'taper' ? 'Fewer reps than before: this keeps the top end sharp without digging a hole.' : 'Hard but even: the last rep should feel like the first.';
      return {
        distanceKm: total,
        title: `${reps} × 1 km intervals`,
        description: `${f(wu)} warm-up · ${reps} × 1 km at interval pace with 400 m (2–3 min) easy jog · ${f(cd)} cool-down. ${note}`,
      };
    }
    case 'marathonPace': {
      const w = roundHalf(work);
      const total = roundHalf(wu + w + cd);
      return {
        distanceKm: total,
        title: `${f(w)} at marathon pace`,
        description: `${f(wu)} warm-up · ${f(w)} at goal marathon pace · ${f(cd)} cool-down. Practise fuelling and your race-day kit.`,
      };
    }
  }
}

/** Build one calendar week of sessions (7 entries, Monday first). */
export function buildWeek(input: WeekTemplateInput): Session[] {
  const {
    index,
    startDate,
    phase,
    targetKm,
    isStepBack,
    daysPerWeek,
    longRunDay,
    availableDays,
    blockedDates,
    longCapKm,
    longFloorKm = 0,
    paces,
    createdAt,
    phaseOrdinal = 0,
    phaseLength = 1,
    easyOnly = false,
    units = 'km',
  } = input;

  const dates = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));
  const available = availableDays.filter((d) => !blockedDates.has(dates[d]!) && dates[d]! >= createdAt);
  const reduced = isStepBack || blockedDates.size >= 3;
  // Tiny weeks and return-to-running weeks: just run easy.
  const kinds = easyOnly || targetKm < MIN_WEEK_FOR_QUALITY_KM ? [] : qualityKinds(phase, index, daysPerWeek, reduced, phaseOrdinal, phaseLength);
  const f = (n: number) => fmtKm(n, units);
  const roles = chooseRunDays(longRunDay, daysPerWeek, available, kinds.length);
  const dist = distribute(targetKm, phase, longCapKm, roles.quality.length, roles.easy.length, longFloorKm);

  const sessions: Session[] = dates.map((date, d) => {
    const blocked = blockedDates.get(date);
    if (date < createdAt) {
      return make(date, 'rest', 0, phase, 'Before plan start', 'This day is before the plan was created.');
    }
    if (blocked) {
      return { ...make(date, 'rest', 0, phase, 'Rest', `Blocked: ${blocked}.`), adjusted: true };
    }
    if (roles.long === d) {
      return {
        ...make(date, 'long', dist.longKm, phase, `Long run ${f(dist.longKm)}`, longDescription(phase, index, dist.longKm, phaseOrdinal, phaseLength, easyOnly, units)),
        pace: paceFor('long', paces),
      };
    }
    const qi = roles.quality.indexOf(d as Weekday);
    if (qi >= 0 && qi >= dist.qualityKm.length) {
      return make(date, 'rest', 0, phase, 'Rest', 'No running. Walk, stretch, sleep.');
    }
    if (qi >= 0) {
      const kind = kinds[qi] ?? 'tempo';
      const s = structureQuality(kind, dist.qualityKm[qi] ?? MIN_QUALITY_RUN_KM, phase, units);
      return { ...make(date, kind, s.distanceKm, phase, s.title, s.description), pace: paceFor(kind, paces) };
    }
    const ei = roles.easy.indexOf(d as Weekday);
    if (ei >= 0 && ei < dist.easyKm.length) {
      const km = dist.easyKm[ei] ?? 0;
      const afterLong = roles.long !== undefined && ((roles.long + 1) % 7) === d;
      if (afterLong) {
        return { ...make(date, 'recovery', km, phase, `Recovery jog ${f(km)}`, 'Very easy. The point is blood flow, not fitness.'), pace: paceFor('recovery', paces) };
      }
      const beforeQuality = roles.quality.some((q) => ((d + 1) % 7) === q);
      const strides = beforeQuality && phase !== 'base' ? ' Finish with 6 × 20 s relaxed strides.' : '';
      const back = easyOnly ? ' Easy only this week: let the body re-adapt before adding intensity.' : '';
      return { ...make(date, 'easy', km, phase, `Easy run ${f(km)}`, `Conversational pace.${strides}${back}`), pace: paceFor('easy', paces) };
    }
    return make(date, 'rest', 0, phase, 'Rest', 'No running. Walk, stretch, sleep.');
  });
  return sessions;
}

/** Share of the long run at marathon pace: grows 30 % → 50 % over the peak phase, every other week. */
export function marathonPaceShare(phaseOrdinal: number, phaseLength: number): number {
  if (phaseLength <= 1) return 0.3;
  const mpWeek = phaseOrdinal % 2 === 1 || phaseOrdinal === phaseLength - 1;
  if (!mpWeek) return 0;
  return Math.min(0.5, 0.3 + 0.1 * Math.floor(phaseOrdinal / 2));
}

function longDescription(phase: Phase, index: number, km: number, phaseOrdinal: number, phaseLength: number, easyOnly: boolean, units: Units): string {
  if (easyOnly) return 'All easy, no fast finish. Time on feet while the body gets back into rhythm.';
  if (phase === 'peak' && km >= 20) {
    const share = marathonPaceShare(phaseOrdinal, phaseLength);
    if (share > 0) {
      const mp = Math.max(4, Math.round(km * share));
      return `Easy for most of it, then the last ${fmtKm(mp, units)} at marathon pace. The key marathon-specific workout.`;
    }
  }
  if (phase === 'build' && index % 2 === 1 && km >= 16) {
    return 'Easy, with the final 20 minutes at a steady (marathon-ish) effort.';
  }
  if (phase === 'maintain' && phaseOrdinal % 3 === 2 && km >= 16) {
    return 'The longer one this cycle: easy, with the final 20 minutes at a steady (marathon-ish) effort.';
  }
  if (phase === 'taper') return 'Relaxed. Keep the routine, drop the fatigue.';
  return 'Conversational pace throughout. Time on feet is the goal.';
}

function make(date: LocalDate, type: SessionType, km: number, phase: Phase, title: string, description: string): Session {
  return { id: `${date}-${type}`, date, type, distanceKm: km, title, description, phase };
}

export function weekdayLabel(d: Weekday): string {
  return WEEKDAY_NAMES[d];
}
