import { addDays, WEEKDAY_NAMES } from '@/domain/dates';
import type { LocalDate, Weekday } from '@/domain/dates';
import type { PaceRange, PaceZones, Phase, Session, SessionType } from '@/domain/types';

export const MAX_LONG_RUN_KM = 35;
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
  paces?: PaceZones;
  /** Days before this date are not planned. */
  createdAt: LocalDate;
}

export type QualityKind = 'tempo' | 'intervals' | 'marathonPace';

/** Which quality sessions a week gets, by phase. Parity alternates stimulus week to week. */
export function qualityKinds(phase: Phase, index: number, daysPerWeek: number, isStepBack: boolean): QualityKind[] {
  const odd = index % 2 === 1;
  switch (phase) {
    case 'base':
      return ['tempo'];
    case 'build': {
      const kinds: QualityKind[] = odd ? ['intervals', 'tempo'] : ['tempo', 'intervals'];
      return daysPerWeek >= 5 && !isStepBack ? kinds : kinds.slice(0, 1);
    }
    case 'peak': {
      const kinds: QualityKind[] = odd ? ['tempo', 'marathonPace'] : ['marathonPace', 'tempo'];
      return daysPerWeek >= 5 && !isStepBack ? kinds : kinds.slice(0, 1);
    }
    case 'taper':
      return ['tempo'];
  }
}

export function longRunFraction(phase: Phase): number {
  switch (phase) {
    case 'base':
      return 0.3;
    case 'build':
      return 0.35;
    case 'peak':
      return 0.38;
    case 'taper':
      return 0.3;
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

const dayOffsets = [0, 3, 5, 2, 4, 6, 1] as const;

function circularDistance(a: Weekday, b: Weekday): number {
  const d = Math.abs(a - b);
  return Math.min(d, 7 - d);
}

/** Pick which weekdays are run days and which roles they play. */
export function chooseRunDays(
  longRunDay: Weekday,
  daysPerWeek: number,
  available: Weekday[],
  qualityCount: number,
): { long?: Weekday; quality: Weekday[]; easy: Weekday[] } {
  const avail = new Set(available);
  if (avail.size === 0 || daysPerWeek <= 0) return { quality: [], easy: [] };

  // Long run on the preferred day, otherwise the nearest available day.
  let long: Weekday | undefined;
  for (const delta of [0, -1, 1, -2, 2, -3, 3]) {
    const d = (((longRunDay + delta) % 7) + 7) % 7 as Weekday;
    if (avail.has(d)) {
      long = d;
      break;
    }
  }
  if (long === undefined) return { quality: [], easy: [] };

  const ordered = dayOffsets.map((o) => ((long! + o) % 7) as Weekday).filter((d) => avail.has(d));
  const runDays = ordered.slice(0, Math.min(daysPerWeek, ordered.length));
  const others = runDays.filter((d) => d !== long);

  const quality: Weekday[] = [];
  const wanted = Math.min(qualityCount, others.length);
  for (const minGap of [2, 1, 0]) {
    for (const d of others) {
      if (quality.length >= wanted) break;
      if (quality.includes(d)) continue;
      if (circularDistance(d, long) < minGap) continue;
      if (quality.some((q) => circularDistance(q, d) < minGap)) continue;
      quality.push(d);
    }
    if (quality.length >= wanted) break;
  }
  const easy = others.filter((d) => !quality.includes(d));
  return { long, quality, easy };
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
): Distribution {
  const target = Math.max(0, targetKm);
  const cap = Math.min(longCapKm, MAX_LONG_RUN_KM);
  let longKm = Math.min(target * longRunFraction(phase), cap);
  const qFraction = phase === 'base' ? 0.15 : 0.18;
  // No other run may exceed the long-run cap: volume that cannot be placed is dropped.
  const perRunCap = Math.max(cap, MIN_QUALITY_RUN_KM);
  let qualityKm = Array<number>(qualityCount).fill(Math.min(perRunCap, Math.max(MIN_QUALITY_RUN_KM, target * qFraction)));

  let remaining = target - longKm - sum(qualityKm);
  let easyCount = easyDays;
  while (easyCount > 0 && remaining / easyCount < MIN_EASY_RUN_KM) easyCount--;

  if (remaining < 0) {
    // Tiny week: scale the hard sessions down to fit.
    const hard = longKm + sum(qualityKm);
    const scale = hard > 0 ? target / hard : 0;
    longKm *= scale;
    qualityKm = qualityKm.map((q) => q * scale);
    remaining = 0;
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

export function structureQuality(kind: QualityKind, km: number, phase: Phase): QualityStructure {
  const wu = km >= 8 ? 2 : 1.5;
  const cd = km >= 8 ? 1.5 : 1;
  const work = Math.max(2, km - wu - cd);
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
        title: `Tempo ${w} km`,
        description: `${wu} km warm-up · ${w} km at threshold pace · ${cd} km cool-down. ${note}`,
      };
    }
    case 'intervals': {
      const reps = Math.max(3, Math.min(8, Math.round((work + 0.4) / 1.4)));
      const total = roundHalf(wu + reps * 1.4 - 0.4 + cd);
      return {
        distanceKm: total,
        title: `${reps} × 1 km intervals`,
        description: `${wu} km warm-up · ${reps} × 1 km at interval pace with 400 m (2–3 min) easy jog · ${cd} km cool-down. Hard but even: the last rep should feel like the first.`,
      };
    }
    case 'marathonPace': {
      const w = roundHalf(work);
      const total = roundHalf(wu + w + cd);
      return {
        distanceKm: total,
        title: `${w} km at marathon pace`,
        description: `${wu} km warm-up · ${w} km at goal marathon pace · ${cd} km cool-down. Practise fuelling and your race-day kit.`,
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
    paces,
    createdAt,
  } = input;

  const dates = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));
  const available = availableDays.filter((d) => !blockedDates.has(dates[d]!) && dates[d]! >= createdAt);
  const reduced = isStepBack || blockedDates.size >= 3;
  // Tiny weeks (returning from a layoff, very low volume): just run easy.
  const kinds = targetKm < MIN_WEEK_FOR_QUALITY_KM ? [] : qualityKinds(phase, index, daysPerWeek, reduced);
  const roles = chooseRunDays(longRunDay, daysPerWeek, available, kinds.length);
  const dist = distribute(targetKm, phase, longCapKm, roles.quality.length, roles.easy.length);

  const sessions: Session[] = dates.map((date, d) => {
    const blocked = blockedDates.get(date);
    if (date < createdAt) {
      return make(date, 'rest', 0, phase, 'Before plan start', 'This day is before the plan was created.');
    }
    if (blocked) {
      return { ...make(date, 'rest', 0, phase, 'Rest', `Blocked: ${blocked}.`), adjusted: true };
    }
    if (roles.long === d) {
      return { ...make(date, 'long', dist.longKm, phase, `Long run ${dist.longKm} km`, longDescription(phase, index, dist.longKm)), pace: paceFor('long', paces) };
    }
    const qi = roles.quality.indexOf(d as Weekday);
    if (qi >= 0) {
      const kind = kinds[qi] ?? 'tempo';
      const s = structureQuality(kind, dist.qualityKm[qi] ?? MIN_QUALITY_RUN_KM, phase);
      return { ...make(date, kind, s.distanceKm, phase, s.title, s.description), pace: paceFor(kind, paces) };
    }
    const ei = roles.easy.indexOf(d as Weekday);
    if (ei >= 0 && ei < dist.easyKm.length) {
      const km = dist.easyKm[ei] ?? 0;
      const afterLong = roles.long !== undefined && ((roles.long + 1) % 7) === d;
      if (afterLong) {
        return { ...make(date, 'recovery', km, phase, `Recovery jog ${km} km`, 'Very easy. The point is blood flow, not fitness.'), pace: paceFor('recovery', paces) };
      }
      const beforeQuality = roles.quality.some((q) => ((d + 1) % 7) === q);
      const strides = beforeQuality && phase !== 'base' ? ' Finish with 6 × 20 s relaxed strides.' : '';
      return { ...make(date, 'easy', km, phase, `Easy run ${km} km`, `Conversational pace.${strides}`), pace: paceFor('easy', paces) };
    }
    return make(date, 'rest', 0, phase, 'Rest', 'No running. Walk, stretch, sleep.');
  });
  return sessions;
}

function longDescription(phase: Phase, index: number, km: number): string {
  if (phase === 'peak' && index % 2 === 1 && km >= 20) {
    const mp = Math.max(4, Math.round(km * 0.3));
    return `Easy for most of it, then the last ${mp} km at marathon pace. The key marathon-specific workout.`;
  }
  if (phase === 'build' && index % 2 === 1 && km >= 16) {
    return 'Easy, with the final 20 minutes at a steady (marathon-ish) effort.';
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
