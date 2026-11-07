import type { Phase } from '@/domain/types';
import { levelResponse, MAX_WEEKLY_RAMP } from './fitness';
import { taperFractions } from './periodize';

export const STEP_BACK_FACTOR = 0.8;
export const MIN_LEVEL_KM = 8;
/** Share of peak volume held during a maintain phase. */
export const MAINTAIN_FACTOR = 0.9;

export interface WeekVolumeInput {
  phase: Phase;
  isStepBack: boolean;
  /** Days in this week that are blocked (vacation, injury, ...). */
  blockedDays: number;
  /** Multiplier applied for a tune-up race in this week (mini taper). */
  raceFactor: number;
  /** Share of the peak this week's segment aims for (1 normally, 0.9 while maintaining). */
  targetFactor?: number;
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
      const factor = w.targetFactor ?? 1;
      const target = peak * factor;
      // Ramp towards the target of this segment (weeks sharing the same target factor).
      let segmentEnd = i;
      while (segmentEnd < lastPeakIdx && weeks[segmentEnd + 1]!.phase !== 'taper' && (weeks[segmentEnd + 1]!.targetFactor ?? 1) === factor) segmentEnd++;
      const rampWeeks = countRampWeeks(weeks, i, segmentEnd);
      if (!w.isStepBack) {
        const rate = level >= target ? 1 : Math.min(MAX_WEEKLY_RAMP, Math.pow(target / level, 1 / rampWeeks));
        level = Math.min(Math.max(level, target), level * rate);
      }
      lastPeakLevel = Math.min(level, target);
      planned = w.isStepBack ? lastPeakLevel * STEP_BACK_FACTOR : lastPeakLevel;
      // While holding below peak, fitness settles at what is actually run, so the
      // final block ramps up again instead of jumping.
      if (factor < 1) level = Math.min(level, target);
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
