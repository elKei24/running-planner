import { addDays, dateRange, formatDate, startOfWeek, weekday, weeksBetween } from '@/domain/dates';
import type { LocalDate, Weekday } from '@/domain/dates';
import type {
  BlockEvent,
  PlanWarning,
  PlannerState,
  RaceEvent,
  Schedule,
  Session,
  Week,
} from '@/domain/types';
import { applyGoalRace, applyRaces } from './events';
import { estimateFitness } from './fitness';
import { formatDuration, paceZones, vdotFromRace } from './paces';
import { FAST_STRATEGY_MIN_WEEKS, periodize, phasePosition } from './periodize';
import { buildWeek, establishedLongRunFloor, maintainLongRunBoost, marathonLongRunFloor, MAX_LONG_RUN_KM } from './template';
import type { WeekTemplateInput } from './template';
import { computeVolumes, MAINTAIN_FACTOR } from './volume';
import type { WeekVolumeInput } from './volume';

export const B_RACE_WEEK_FACTOR = 0.85;
export const LONG_RUN_FIRST_STEP_KM = 3;
export const LONG_RUN_WEEKLY_STEP_KM = 2.5;
export const MAX_LONG_RUN_MINUTES = 210;
const ALL_DAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

/**
 * Derive the whole schedule from the persisted state and today's date.
 * Pure: same inputs → same schedule. Nothing about the plan is stored.
 */
export function plan(state: PlannerState, todayDate: LocalDate): Schedule {
  const anchorDate = startOfWeek(todayDate);
  const fitness = estimateFitness(state, anchorDate);
  const paces = derivePaces(state);
  const warnings: PlanWarning[] = [];

  const totalWeeks = weeksBetween(anchorDate, state.goal.date);
  if (totalWeeks < 1 || state.goal.date < todayDate) {
    warnings.push({ level: 'info', message: 'The goal race is in the past. Set a new goal to get a fresh plan.' });
    return { weeks: [], warnings, paces, fitness, anchorDate };
  }

  const strategy = state.athlete.buildStrategy ?? 'steady';
  const { phases } = periodize(totalWeeks, strategy);
  const createdWeek = startOfWeek(state.createdAt);
  const races = state.events.filter((e): e is RaceEvent => e.kind === 'race');
  const blocks = state.events.filter((e): e is BlockEvent => e.kind === 'block');
  const lastPeakIdx = phases.lastIndexOf('peak') >= 0 ? phases.lastIndexOf('peak') : phases.lastIndexOf('build');

  const weekStarts = phases.map((_, i) => addDays(anchorDate, 7 * i));
  const blockedByDate = new Map<LocalDate, string>();
  for (const b of blocks) for (const d of dateRange(b.from, b.to)) blockedByDate.set(d, b.reason);

  const volumeInputs: WeekVolumeInput[] = phases.map((phase, i) => {
    const start = weekStarts[i]!;
    const sinceCreation = weeksBetween(createdWeek, start) - 1;
    const days = dateRange(start, addDays(start, 6));
    const blockedDays = days.filter((d) => blockedByDate.has(d) && d >= state.createdAt).length;
    const isStepBack =
      phase !== 'taper' &&
      sinceCreation > 0 &&
      (sinceCreation + 1) % 4 === 0 &&
      i !== lastPeakIdx &&
      i !== lastPeakIdx - 1 &&
      blockedDays < 3;
    const hasBRace = races.some((r) => r.priority === 'B' && startOfWeek(r.date) === start);
    return { phase, isStepBack, blockedDays, raceFactor: hasBRace ? B_RACE_WEEK_FACTOR : 1, targetFactor: phase === 'maintain' ? MAINTAIN_FACTOR : 1 };
  });
  const volumes = computeVolumes(fitness.levelKm, state.athlete.peakWeeklyKm, volumeInputs);

  // Long-run cap grows a little every ramp week, and never exceeds ~3 hours.
  const timeCapKm = paces ? (MAX_LONG_RUN_MINUTES * 60) / ((paces.easy.minSecPerKm + paces.easy.maxSecPerKm) / 2) : MAX_LONG_RUN_KM;
  let rampIndex = 0;
  const units = state.prefs.units;
  // Return to running after a layoff: one easy-only week, two after a longer break.
  const easyOnlyWeeks = Math.min(2, fitness.layoffWeeks);
  const weeks: Week[] = phases.map((phase, i) => {
    const start = weekStarts[i]!;
    const vol = volumes[i]!;
    const vin = volumeInputs[i]!;
    const longCapKm = Math.min(
      MAX_LONG_RUN_KM,
      timeCapKm,
      fitness.longRunKm + LONG_RUN_FIRST_STEP_KM + LONG_RUN_WEEKLY_STEP_KM * rampIndex,
    );
    if (phase !== 'taper' && !vin.isStepBack) rampIndex++;

    const override = state.events.find((e) => e.kind === 'availability' && e.weekOf === start);
    const availableDays = override && override.kind === 'availability' ? override.days : ALL_DAYS;
    const blockedDates = new Map<LocalDate, string>();
    for (const d of dateRange(start, addDays(start, 6))) {
      const reason = blockedByDate.get(d);
      if (reason) blockedDates.set(d, reason);
    }
    const isRaceWeek = startOfWeek(state.goal.date) === start;
    // The week the plan was created in is usually partial: pro-rate its volume.
    const partial = start === createdWeek ? (7 - weekday(state.createdAt)) / 7 : 1;
    const { ordinal: phaseOrdinal, length: phaseLength } = phasePosition(phases, i);
    const easyOnly = i < easyOnlyWeeks && phase !== 'taper';
    // Never below what the athlete already runs (share of the full week, so a partial
    // first week keeps its long run), and at least the marathon target in the peak phase.
    const finalBuild = phase === 'build' && phases[i + (phaseLength - phaseOrdinal)] === 'peak';
    const longFloorKm = Math.max(
      establishedLongRunFloor(fitness.longRunKm, vol.targetKm),
      easyOnly ? 0 : marathonLongRunFloor(state.goal.distanceKm, phase, vol.targetKm * partial, phaseOrdinal, finalBuild),
      easyOnly || vin.isStepBack ? 0 : maintainLongRunBoost(phase, vol.targetKm, phaseOrdinal),
    );
    const input: WeekTemplateInput = {
      index: i,
      startDate: start,
      phase,
      targetKm: Math.round(vol.targetKm * partial * 10) / 10,
      isStepBack: vin.isStepBack,
      isRaceWeek,
      daysPerWeek: state.athlete.daysPerWeek,
      longRunDay: state.athlete.longRunDay,
      availableDays,
      blockedDates,
      longCapKm,
      longFloorKm,
      paces,
      createdAt: state.createdAt,
      phaseOrdinal,
      phaseLength,
      easyOnly,
      units,
    };
    const sessions = buildWeek(input);
    const notes: string[] = [];
    if (easyOnly) notes.push(fitness.layoffWeeks >= 2 ? 'Back after a break: easy running only while the body re-adapts.' : 'Light week last week: easy running only, intensity returns next week.');
    if (vin.isStepBack) notes.push('Step-back week: lower volume so the previous weeks can sink in.');
    if (phase === 'taper' && !isRaceWeek) notes.push('Taper: volume drops, intensity stays. Trust the work.');
    if (vin.blockedDays > 0) notes.push(`${vin.blockedDays} day${vin.blockedDays > 1 ? 's' : ''} blocked this week; volume reduced.`);
    if (override) notes.push('Custom availability applied this week.');
    if (vin.raceFactor < 1) notes.push('Tune-up race this week: slightly reduced volume around it.');
    if (phase === 'maintain') {
      const blockStart = weekStarts[phases.indexOf('build', i)];
      notes.push(`Maintaining about ${Math.round(MAINTAIN_FACTOR * 100)} % of peak volume with varied quality.${blockStart ? ` The marathon block starts ${formatDate(blockStart, { year: true })}.` : ''}`);
    }
    return { index: i, startDate: start, phase, targetKm: vol.targetKm, isStepBack: vin.isStepBack, isRaceWeek, sessions, notes };
  });

  // Overlays operate on the flat date → session map.
  const map = new Map<LocalDate, Session>();
  for (const w of weeks) for (const s of w.sessions) map.set(s.date, s);
  applyRaces(map, races, state.createdAt, paces, units);
  const raceWeek = weeks[weeks.length - 1]!;
  applyGoalRace(map, state.goal, raceWeek.targetKm, state.athlete.daysPerWeek, new Set(blockedByDate.keys()), state.createdAt, paces, units);
  for (const w of weeks) {
    w.sessions = w.sessions.map((s) => map.get(s.date) ?? s);
    w.targetKm = Math.round(w.sessions.reduce((a, s) => a + s.distanceKm, 0) * 10) / 10;
  }

  warnings.push(...collectWarnings(state, totalWeeks, fitness.levelKm, paces?.predictedGoalTimeSec, races, blocks, weeks, timeCapKm));
  return { weeks, warnings, paces, fitness, anchorDate };
}

function derivePaces(state: PlannerState) {
  const ref = state.athlete.referenceRace;
  if (ref && ref.distanceKm > 0 && ref.timeSec > 0) {
    return paceZones(vdotFromRace(ref.distanceKm, ref.timeSec), state.goal.distanceKm);
  }
  if (state.goal.targetTimeSec && state.goal.targetTimeSec > 0) {
    return paceZones(vdotFromRace(state.goal.distanceKm, state.goal.targetTimeSec), state.goal.distanceKm);
  }
  return undefined;
}

function collectWarnings(
  state: PlannerState,
  totalWeeks: number,
  levelKm: number,
  predictedGoalTimeSec: number | undefined,
  races: RaceEvent[],
  blocks: BlockEvent[],
  weeks: Week[],
  timeCapKm: number,
): PlanWarning[] {
  const out: PlanWarning[] = [];
  if (totalWeeks < 8) {
    out.push({ level: 'danger', message: `Only ${totalWeeks} week${totalWeeks === 1 ? '' : 's'} to race day. A marathon build normally needs 12–18 weeks; expect a compressed plan.` });
  } else if (totalWeeks < 12) {
    out.push({ level: 'warn', message: `${totalWeeks} weeks to race day is on the short side. 16 weeks is a comfortable marathon build.` });
  }
  if ((state.athlete.buildStrategy ?? 'steady') === 'fast' && totalWeeks < FAST_STRATEGY_MIN_WEEKS) {
    out.push({ level: 'info', message: `"Build fast, then maintain" only differs from a steady build beyond ${FAST_STRATEGY_MIN_WEEKS - 1} weeks; with ${totalWeeks} weeks the plan is a steady build.` });
  }
  if (levelKm < 20) {
    out.push({ level: 'warn', message: `Current volume is about ${Math.round(levelKm)} km/week. The plan ramps gently; consider a later race if you are starting from scratch.` });
  }
  if (state.athlete.peakWeeklyKm < levelKm) {
    out.push({ level: 'info', message: 'Your peak volume setting is below what you already run. The plan will hold volume steady.' });
  }
  if (predictedGoalTimeSec && state.goal.targetTimeSec && state.goal.targetTimeSec < predictedGoalTimeSec * 0.95) {
    out.push({ level: 'warn', message: `Target ${formatDuration(state.goal.targetTimeSec)} is ambitious: current fitness predicts about ${formatDuration(predictedGoalTimeSec)}.` });
  }
  const taperStart = weeks.find((w) => w.phase === 'taper')?.startDate;
  if (taperStart) {
    for (const r of races) {
      if (r.date >= taperStart && r.date < state.goal.date && r.priority === 'B') {
        out.push({ level: 'warn', message: `Tune-up race on ${r.date} falls inside the taper. A 10 km or shorter is fine; longer will cost you on race day.` });
      }
    }
    for (const b of blocks) {
      if (b.to >= taperStart && b.from <= state.goal.date && b.reason !== 'vacation') {
        out.push({ level: 'info', message: `A ${b.reason} block overlaps the taper. Rest beats cramming at this point.` });
      }
    }
  }
  const lastPeak = [...weeks].reverse().find((w) => w.phase === 'peak' || w.phase === 'build');
  const longest = lastPeak ? Math.max(...lastPeak.sessions.map((s) => (s.type === 'long' ? s.distanceKm : 0))) : 0;
  if (lastPeak && longest > 0 && longest < 26 && state.goal.distanceKm > 40) {
    const peak = state.athlete.peakWeeklyKm;
    const intro = `The longest planned run is ${longest} km; finishing a marathon strongly usually needs 28–32 km.`;
    if (timeCapKm < 26 && timeCapKm <= longest + 0.5) {
      out.push({ level: 'warn', message: `${intro} It is capped at about ${MAX_LONG_RUN_MINUTES / 60} hours at your easy pace. That is a sensible limit for slower runners; as your reference race improves, the cap grows.` });
    } else if (peak * 0.5 <= longest + 0.5) {
      out.push({ level: 'warn', message: `${intro} It is limited by your peak weekly volume (${Math.round(peak)} km): a long run should not exceed half the week. Raise peak weekly volume in Settings → Athlete (about 60 km/week allows 30 km) if you can train more.` });
    } else {
      out.push({ level: 'warn', message: `${intro} There may not be enough weeks to build up safely; the long run grows by about 2.5 km per week from what you have run recently.` });
    }
  }
  return out;
}
