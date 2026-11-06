import type { Phase, Session, SessionType } from '@/domain/types';

export const PHASE_LABEL: Record<Phase, string> = { base: 'Base', build: 'Build', peak: 'Peak', taper: 'Taper' };

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

export function km(n: number): string {
  return `${Number.isInteger(n) ? n : n.toFixed(1).replace(/\.0$/, '')} km`;
}

export function sessionTypeLabel(s: Session): string {
  return TYPE_LABEL[s.type];
}

export const DISTANCE_PRESETS: Array<{ label: string; km: number }> = [
  { label: '5 km', km: 5 },
  { label: '10 km', km: 10 },
  { label: 'Half marathon', km: 21.0975 },
  { label: 'Marathon', km: 42.195 },
];
