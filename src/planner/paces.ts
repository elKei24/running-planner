import type { PaceRange, PaceZones } from '@/domain/types';

/**
 * Jack Daniels' VDOT model (Daniels & Gilbert, 1979). All formulas use
 * velocity in metres per minute and time in minutes.
 */

/** Oxygen cost of running at velocity v (m/min). */
export function oxygenCost(v: number): number {
  return -4.6 + 0.182258 * v + 0.000104 * v * v;
}

/** Fraction of VO2max that can be sustained for t minutes. */
export function sustainableFraction(tMin: number): number {
  return 0.8 + 0.1894393 * Math.exp(-0.012778 * tMin) + 0.2989558 * Math.exp(-0.1932605 * tMin);
}

export function vdotFromRace(distanceKm: number, timeSec: number): number {
  const tMin = timeSec / 60;
  const v = (distanceKm * 1000) / tMin;
  return oxygenCost(v) / sustainableFraction(tMin);
}

/** Velocity (m/min) at which the oxygen cost equals `vo2`. */
export function velocityForOxygenCost(vo2: number): number {
  const a = 0.000104;
  const b = 0.182258;
  const c = -(4.6 + vo2);
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}

/** Pace in seconds per km when running at `fraction` of VO2max for a given VDOT. */
export function paceAtFraction(vdot: number, fraction: number): number {
  const v = velocityForOxygenCost(vdot * fraction);
  return (1000 / v) * 60;
}

/** Predicted race time (seconds) over `distanceKm` for a given VDOT (bisection on time). */
export function predictTime(vdot: number, distanceKm: number): number {
  const d = distanceKm * 1000;
  let lo = d / 700; // minutes, absurdly fast
  let hi = d / 60; // minutes, very slow walk/jog
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const f = oxygenCost(d / mid) - vdot * sustainableFraction(mid);
    if (f > 0) lo = mid;
    else hi = mid;
  }
  return ((lo + hi) / 2) * 60;
}

function range(vdot: number, slowFraction: number, fastFraction: number): PaceRange {
  return {
    minSecPerKm: Math.round(paceAtFraction(vdot, fastFraction)),
    maxSecPerKm: Math.round(paceAtFraction(vdot, slowFraction)),
  };
}

/**
 * Training zones as fractions of VO2max, following Daniels' Running Formula:
 * E 59-74%, M ~ marathon race intensity, T 83-88%, I 95-100%.
 */
export function paceZones(vdot: number, goalDistanceKm: number): PaceZones {
  const predictedGoalTimeSec = predictTime(vdot, goalDistanceKm);
  const marathonTimeSec = predictTime(vdot, 42.195);
  const mPace = marathonTimeSec / 42.195;
  return {
    vdot,
    easy: range(vdot, 0.62, 0.74),
    marathon: { minSecPerKm: Math.round(mPace * 0.98), maxSecPerKm: Math.round(mPace * 1.02) },
    threshold: range(vdot, 0.83, 0.88),
    interval: range(vdot, 0.95, 1.0),
    predictedGoalTimeSec,
  };
}

/** Equal-effort race pace range for a race of `distanceKm` (seconds per km). */
export function racePace(vdot: number, distanceKm: number): PaceRange {
  const pace = predictTime(vdot, distanceKm) / distanceKm;
  return { minSecPerKm: Math.round(pace * 0.98), maxSecPerKm: Math.round(pace * 1.02) };
}

export function formatPace(secPerKm: number): string {
  const s = Math.round(secPerKm);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function formatPaceRange(p: PaceRange): string {
  return `${formatPace(p.minSecPerKm)}–${formatPace(p.maxSecPerKm)} /km`;
}

export function formatDuration(totalSec: number): string {
  const s = Math.round(totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function parseDuration(text: string): number | undefined {
  const parts = text
    .trim()
    .split(':')
    .map((p) => Number(p));
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !Number.isFinite(p) || p < 0)) {
    return undefined;
  }
  if (parts.length === 2) {
    const [m, s] = parts as [number, number];
    return m * 60 + s;
  }
  const [h, m, s] = parts as [number, number, number];
  return h * 3600 + m * 60 + s;
}
