import { addDays, diffDays, startOfWeek, weekday } from '@/domain/dates';
import type { LocalDate } from '@/domain/dates';
import type { FitnessEstimate, LogEntry, PlannerState, WeeklyLoad } from '@/domain/types';

export const MAX_WEEKLY_RAMP = 1.1;

/**
 * How the sustainable weekly "level" responds to one week of actual load.
 *
 * `ratio` is actual / level. The response is piecewise linear and monotone:
 *   - ratio >= 1       → level grows with the actual load, at most +10 %
 *   - 0.85 <= r < 1    → unchanged (small deviations are noise, not detraining)
 *   - 0.5  <= r < 0.85 → mild reduction down to -15 %
 *   - r < 0.5          → a layoff week, down to -30 % for a week with no running
 *
 * This matches return-to-running guidance: ~75 % after one week off, ~50 %
 * after two, and the usual "no more than 10 % per week" progression.
 */
export function levelResponse(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio < 0) return 1;
  if (ratio >= 1) return Math.min(ratio, MAX_WEEKLY_RAMP);
  if (ratio >= 0.85) return 1;
  if (ratio >= 0.5) return 0.85 + (0.15 * (ratio - 0.5)) / 0.35;
  return 0.7 + (0.15 * ratio) / 0.5;
}

/** Sum the log into Monday-based weeks from `fromWeek` (inclusive) to `toWeek` (exclusive). */
export function weeklyLoads(log: LogEntry[], fromWeek: LocalDate, toWeek: LocalDate): WeeklyLoad[] {
  const out: WeeklyLoad[] = [];
  for (let w = fromWeek; w < toWeek; w = addDays(w, 7)) {
    out.push({ startDate: w, km: 0, runs: 0, longestKm: 0, expectedKm: 0 });
  }
  for (const entry of log) {
    if (entry.skipped || entry.distanceKm <= 0) continue;
    const w = startOfWeek(entry.date);
    if (w < fromWeek || w >= toWeek) continue;
    const idx = Math.round(diffDays(fromWeek, w) / 7);
    const load = out[idx];
    if (!load) continue;
    load.km += entry.distanceKm;
    load.runs += 1;
    load.longestKm = Math.max(load.longestKm, entry.distanceKm);
  }
  return out;
}

/**
 * Estimate current fitness from the declared starting point and the log,
 * replaying every completed week since the baseline date. Only weeks strictly
 * before `anchorDate` (the Monday of the current week) are considered, so the
 * estimate - and therefore the plan - is stable within a week.
 */
export function estimateFitness(state: PlannerState, anchorDate: LocalDate): FitnessEstimate {
  const baseline = state.baselineDate ?? state.createdAt;
  const baselineWeek = startOfWeek(baseline);
  const history = weeklyLoads(state.log, baselineWeek, anchorDate);

  let level = Math.max(0, state.athlete.weeklyKmRecent);
  let layoffWeeks = 0;
  for (const week of history) {
    // The baseline week may be partial: compare against a pro-rated level.
    let fraction = 1;
    if (week.startDate === baselineWeek) {
      fraction = (7 - weekday(baseline)) / 7;
    }
    const expected = level * fraction;
    week.expectedKm = Math.round(expected * 10) / 10;
    const ratio = expected > 0 ? week.km / expected : week.km > 0 ? 1 : 0;
    level *= levelResponse(ratio);
    if (expected === 0 && week.km > 0) level = Math.max(level, week.km);
    layoffWeeks = ratio < 0.5 && expected > 0 ? layoffWeeks + 1 : 0;
  }

  const recent = history.slice(-4);
  const logLongest = recent.reduce((m, w) => Math.max(m, w.longestKm), 0);
  const freshHistory = history.length < 2;
  // A declared weekly volume implies runs of at least volume / days.
  const impliedLongest = state.athlete.weeklyKmRecent / Math.max(1, state.athlete.daysPerWeek);
  const longRunKm = freshHistory
    ? Math.max(logLongest, state.athlete.longestRecentRunKm, impliedLongest)
    : logLongest;

  return {
    levelKm: round1(level),
    longRunKm: round1(longRunKm),
    history,
    source: history.length === 0 ? 'declared' : 'log',
    layoffWeeks,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
