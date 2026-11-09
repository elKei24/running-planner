import { computed } from '@preact/signals';
import type { PaceRange, Phase, SessionType, Units } from '@/domain/types';
import { formatPace } from '@/planner/paces';
import { state } from '@/store/state';

export const KM_PER_MILE = 1.609344;

export const PHASE_LABEL: Record<Phase, string> = { base: 'Base', build: 'Build', maintain: 'Maintain', peak: 'Peak', taper: 'Taper' };

export const TYPE_LABEL: Record<SessionType, string> = {
  rest: 'Rest',
  easy: 'Easy',
  recovery: 'Recovery',
  long: 'Long run',
  tempo: 'Tempo',
  intervals: 'Intervals',
  marathonPace: 'Marathon pace',
  race: 'Race',
};

/** Current display units (reactive). */
export const units = computed<Units>(() => state.value?.prefs.units ?? 'km');

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

/** Format a distance stored in km in the chosen units. */
export function distance(km: number, u: Units = units.value): string {
  return u === 'mi' ? `${trim(Math.round((km / KM_PER_MILE) * 10) / 10)} mi` : `${trim(km)} km`;
}

/** Kept for brevity in the UI: distance in the current units. */
export function km(n: number): string {
  return distance(n);
}

export function pace(secPerKm: number, u: Units = units.value): string {
  return u === 'mi' ? `${formatPace(secPerKm * KM_PER_MILE)} /mi` : `${formatPace(secPerKm)} /km`;
}

export function paceRange(p: PaceRange, u: Units = units.value): string {
  const f = u === 'mi' ? KM_PER_MILE : 1;
  return `${formatPace(p.minSecPerKm * f)}–${formatPace(p.maxSecPerKm * f)} /${u}`;
}

export const DISTANCE_PRESETS: Array<{ label: string; km: number }> = [
  { label: '5 km', km: 5 },
  { label: '10 km', km: 10 },
  { label: 'Half marathon', km: 21.0975 },
  { label: 'Marathon', km: 42.195 },
];

/**
 * Stopwatch-style duration entry: digits fill in from the right, so typing "12345" reads
 * 01:23:45 and "987" reads 00:09:87. Non-digits are ignored; a seventh digit shifts the rest left.
 */
export function durationInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '').slice(-6);
  if (digits === '') return '';
  const p = digits.padStart(6, '0');
  return `${p.slice(0, 2)}:${p.slice(2, 4)}:${p.slice(4)}`;
}
