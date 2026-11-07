import type { BuildStrategy, Phase } from '@/domain/types';

export interface PhasePlan {
  phases: Phase[];
  taperWeeks: number;
  peakWeeks: number;
  buildWeeks: number;
  baseWeeks: number;
  maintainWeeks: number;
}

/** Beyond this many weeks the 'fast' strategy builds, maintains, then runs a marathon block. */
export const FAST_STRATEGY_MIN_WEEKS = 25;
export const FAST_INITIAL_BLOCK_WEEKS = 16;
export const FAST_FINAL_BLOCK = { build: 6, peak: 3, taper: 3 } as const;

/**
 * Allocate phases backwards from race day. The race week is the last taper
 * week. Taper and peak get fixed allocations depending on how much time there
 * is; the remainder is split between build and base.
 */
export function periodize(totalWeeks: number, strategy: BuildStrategy = 'steady'): PhasePlan {
  const n = Math.max(0, Math.floor(totalWeeks));
  if (n === 0) return { phases: [], taperWeeks: 0, peakWeeks: 0, buildWeeks: 0, baseWeeks: 0, maintainWeeks: 0 };
  if (strategy === 'fast' && n >= FAST_STRATEGY_MIN_WEEKS) return periodizeFast(n);

  const taperWeeks = n >= 16 ? 3 : n >= 8 ? 2 : 1;
  const peakWeeks = n >= 12 ? 3 : n >= 8 ? 2 : n >= 4 ? 1 : 0;
  const remainder = n - taperWeeks - peakWeeks;
  const buildWeeks = n >= 8 ? Math.ceil(remainder * 0.5) : remainder;
  const baseWeeks = remainder - buildWeeks;

  const phases: Phase[] = [
    ...Array<Phase>(baseWeeks).fill('base'),
    ...Array<Phase>(buildWeeks).fill('build'),
    ...Array<Phase>(peakWeeks).fill('peak'),
    ...Array<Phase>(taperWeeks).fill('taper'),
  ];
  return { phases, taperWeeks, peakWeeks, buildWeeks, baseWeeks, maintainWeeks: 0 };
}

/**
 * Build fast, then maintain: an initial block of up to 16 weeks ramps to peak
 * volume, a maintain phase holds it, and the last 12 weeks are a marathon block.
 */
function periodizeFast(n: number): PhasePlan {
  const final = FAST_FINAL_BLOCK.build + FAST_FINAL_BLOCK.peak + FAST_FINAL_BLOCK.taper;
  const initial = Math.min(FAST_INITIAL_BLOCK_WEEKS, n - final);
  const maintainWeeks = n - final - initial;
  const baseWeeks = Math.round(initial * 0.375);
  const initialBuild = initial - baseWeeks;
  const phases: Phase[] = [
    ...Array<Phase>(baseWeeks).fill('base'),
    ...Array<Phase>(initialBuild).fill('build'),
    ...Array<Phase>(maintainWeeks).fill('maintain'),
    ...Array<Phase>(FAST_FINAL_BLOCK.build).fill('build'),
    ...Array<Phase>(FAST_FINAL_BLOCK.peak).fill('peak'),
    ...Array<Phase>(FAST_FINAL_BLOCK.taper).fill('taper'),
  ];
  return {
    phases,
    taperWeeks: FAST_FINAL_BLOCK.taper,
    peakWeeks: FAST_FINAL_BLOCK.peak,
    buildWeeks: initialBuild + FAST_FINAL_BLOCK.build,
    baseWeeks,
    maintainWeeks,
  };
}

/** Position of week i within its contiguous run of the same phase, and that run's length. */
export function phasePosition(phases: Phase[], i: number): { ordinal: number; length: number } {
  const phase = phases[i];
  let start = i;
  while (start > 0 && phases[start - 1] === phase) start--;
  let end = i;
  while (end < phases.length - 1 && phases[end + 1] === phase) end++;
  return { ordinal: i - start, length: end - start + 1 };
}

/** Volume as a fraction of the last peak-phase level, for each taper week. */
export function taperFractions(taperWeeks: number): number[] {
  switch (taperWeeks) {
    case 3:
      return [0.8, 0.6, 0.35];
    case 2:
      return [0.7, 0.35];
    default:
      return [0.4];
  }
}
