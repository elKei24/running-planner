import type { Phase } from '@/domain/types';

export interface PhasePlan {
  phases: Phase[];
  taperWeeks: number;
  peakWeeks: number;
  buildWeeks: number;
  baseWeeks: number;
}

/**
 * Allocate phases backwards from race day. The race week is the last taper
 * week. Taper and peak get fixed allocations depending on how much time there
 * is; the remainder is split between build and base.
 */
export function periodize(totalWeeks: number): PhasePlan {
  const n = Math.max(0, Math.floor(totalWeeks));
  if (n === 0) return { phases: [], taperWeeks: 0, peakWeeks: 0, buildWeeks: 0, baseWeeks: 0 };

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
  return { phases, taperWeeks, peakWeeks, buildWeeks, baseWeeks };
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
