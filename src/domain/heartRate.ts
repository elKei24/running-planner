import type { SessionType } from './types';

/**
 * Heart-rate guidance as a share of maximum heart rate, per session type. The easy, marathon,
 * threshold and interval bands are Daniels' (Running Formula, 3rd ed.); recovery sits below the
 * easy band and is a judgement call. Races are not given a band: the right intensity depends on
 * the distance, and the pace or RPE guidance is the better cue.
 */
export const HR_ZONES: ReadonlyArray<{ label: string; types: SessionType[]; min: number; max: number }> = [
  { label: 'Recovery', types: ['recovery'], min: 0.6, max: 0.7 },
  { label: 'Easy / long', types: ['easy', 'long'], min: 0.65, max: 0.79 },
  { label: 'Marathon', types: ['marathonPace'], min: 0.8, max: 0.9 },
  { label: 'Threshold (tempo)', types: ['tempo'], min: 0.88, max: 0.92 },
  { label: 'Intervals', types: ['intervals'], min: 0.95, max: 1 },
];

export const MIN_MAX_HR = 100;
export const MAX_MAX_HR = 230;

/** Heart-rate range in bpm for a session type at the given maximum heart rate, as [min, max]. */
export function expectedHr(type: SessionType, maxHr: number): [number, number] | undefined {
  if (!(maxHr > 0)) return undefined;
  const zone = HR_ZONES.find((z) => z.types.includes(type));
  if (!zone) return undefined;
  return [Math.round(zone.min * maxHr), Math.round(zone.max * maxHr)];
}

export function formatHrRange([min, max]: [number, number]): string {
  return `${min}–${max} bpm`;
}
