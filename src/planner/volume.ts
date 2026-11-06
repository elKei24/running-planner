import type { Phase } from '@/domain/types';
import { levelResponse, MAX_WEEKLY_RAMP } from './fitness';
import { taperFractions } from './periodize';

export const STEP_BACK_FACTOR = 0.8;
export const MIN_LEVEL_KM = 8;

export interface WeekVolumeInput {
  phase: Phase;
  isStepBack: boolean;
  /** Days in this week that are blocked (vacation, injury, ...). */
  blockedDays: number;
  /** Multiplier applied for a tune-up race in this week (mini taper). */
  raceFactor: number;
}

export interface WeekVolume {
  /** Planned load for the week in km, including everything except the goal race itself. */
  targetKm: number;
  /** Sustainable level assumed at the end of the week. */
  levelKm: number;
}

/**
 * Forward-simulate the weekly volume from the current fitness level towards the
 * peak, honouring the 10 %/week ramp limit, step-back weeks, blocks and taper.
 *
 * The ramp rate is recomputed every week from "where we are" to "where we need
 * to be by the end of the peak phase", so any deviation (a skipped week, a
 * vacation) produces a smooth new ramp instead of a jump.
 */
export function computeVolumes(levelKm: number, peakKm: number, weeks: WeekVolumeInput[]): WeekVolume[] {
  let level = Math.max(MIN_LEVEL_KM, levelKm);
  const peak = Math.max(MIN_LEVEL_KM, peakKm);
  const lastPeakIdx = findLastIndex(weeks, (w) => w.phase !== 'taper');
  const taperCount = weeks.filter((w) => w.phase === 'taper').length;
  const fractions = taperFractions(taperCount);
  let lastPeakLevel = Math.min(level, peak);
  let taperIdx = 0;
  const out: WeekVolume[] = [];

  for (let i = 0; i < weeks.length; i++) {
    const w = weeks[i]!;
    let planned: number;
    if (w.phase !== 'taper') {
      const rampWeeks = countRampWeeks(weeks, i, lastPeakIdx);
      if (!w.isStepBack) {
        const rate = level >= peak ? 1 : Math.min(MAX_WEEKLY_RAMP, Math.pow(peak / level, 1 / rampWeeks));
        level = Math.min(Math.max(level, peak), level * rate);
      }
      lastPeakLevel = Math.min(level, peak);
      planned = w.isStepBack ? lastPeakLevel * STEP_BACK_FACTOR : lastPeakLevel;
    } else {
      planned = lastPeakLevel * (fractions[taperIdx] ?? fractions[fractions.length - 1] ?? 0.4);
      taperIdx++;
    }

    const reduction = Math.max(0, 1 - w.blockedDays / 7) * w.raceFactor;
    planned *= reduction;
    // A reduced week (block, mini-taper) lowers the level the next week starts from.
    if (w.phase !== 'taper') level *= levelResponse(reduction);

    out.push({ targetKm: round1(planned), levelKm: round1(level) });
  }
  return out;
}

/** Non-step-back weeks from i to the end of the peak phase, inclusive (at least 1). */
function countRampWeeks(weeks: WeekVolumeInput[], from: number, lastPeakIdx: number): number {
  let n = 0;
  for (let j = from; j <= lastPeakIdx; j++) if (!weeks[j]!.isStepBack) n++;
  return Math.max(1, n);
}

function findLastIndex<T>(arr: T[], pred: (t: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) if (pred(arr[i]!)) return i;
  return -1;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
