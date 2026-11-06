import { useState } from 'preact/hooks';
import { WEEKDAY_LONG_NAMES } from '@/domain/dates';
import type { Weekday } from '@/domain/dates';
import type { Athlete, Goal } from '@/domain/types';
import { formatDuration, parseDuration } from '@/planner/paces';
import { DISTANCE_PRESETS } from './format';

export function defaultPeak(weeklyKm: number, daysPerWeek: number): number {
  const byDays: Record<number, number> = { 1: 25, 2: 35, 3: 45, 4: 60, 5: 75, 6: 90, 7: 100 };
  return Math.round(Math.max(byDays[daysPerWeek] ?? 60, weeklyKm * 1.25));
}

export interface AthleteFormValue {
  weeklyKmRecent: string;
  longestRecentRunKm: string;
  daysPerWeek: string;
  longRunDay: string;
  peakWeeklyKm: string;
  refDistanceKm: string;
  refTime: string;
}

export function athleteToForm(a?: Athlete): AthleteFormValue {
  return {
    weeklyKmRecent: a ? String(a.weeklyKmRecent) : '30',
    longestRecentRunKm: a ? String(a.longestRecentRunKm) : '12',
    daysPerWeek: a ? String(a.daysPerWeek) : '4',
    longRunDay: a ? String(a.longRunDay) : '6',
    peakWeeklyKm: a ? String(a.peakWeeklyKm) : String(defaultPeak(30, 4)),
    refDistanceKm: a?.referenceRace ? String(a.referenceRace.distanceKm) : '10',
    refTime: a?.referenceRace ? formatDuration(a.referenceRace.timeSec) : '',
  };
}

export function formToAthlete(f: AthleteFormValue): Athlete | string {
  const weeklyKmRecent = Number(f.weeklyKmRecent);
  const longestRecentRunKm = Number(f.longestRecentRunKm);
  const daysPerWeek = Number(f.daysPerWeek);
  const peakWeeklyKm = Number(f.peakWeeklyKm);
  if (!(weeklyKmRecent >= 0)) return 'Weekly volume must be a number.';
  if (!(longestRecentRunKm >= 0)) return 'Longest run must be a number.';
  if (!(daysPerWeek >= 1 && daysPerWeek <= 7)) return 'Days per week must be between 1 and 7.';
  if (!(peakWeeklyKm > 0)) return 'Peak weekly volume must be a positive number.';
  const athlete: Athlete = {
    weeklyKmRecent,
    longestRecentRunKm,
    daysPerWeek,
    longRunDay: Number(f.longRunDay) as Weekday,
    peakWeeklyKm,
  };
  if (f.refTime.trim()) {
    const timeSec = parseDuration(f.refTime);
    const distanceKm = Number(f.refDistanceKm);
    if (timeSec === undefined) return 'Reference race time must look like 48:30 or 1:45:00.';
    if (!(distanceKm > 0)) return 'Reference race distance must be positive.';
    athlete.referenceRace = { distanceKm, timeSec };
  }
  return athlete;
}

export function AthleteFields({ value, onChange }: { value: AthleteFormValue; onChange: (v: AthleteFormValue) => void }) {
  const set = (k: keyof AthleteFormValue) => (e: Event) => onChange({ ...value, [k]: (e.currentTarget as HTMLInputElement).value });
  return (
    <div class="grid">
      <label class="field">
        Current weekly volume (km)
        <span class="hint">Average of the last 3–4 weeks.</span>
        <input type="number" min="0" step="1" inputMode="decimal" value={value.weeklyKmRecent} onInput={set('weeklyKmRecent')} required />
      </label>
      <label class="field">
        Longest recent run (km)
        <input type="number" min="0" step="0.5" inputMode="decimal" value={value.longestRecentRunKm} onInput={set('longestRecentRunKm')} required />
      </label>
      <label class="field">
        Running days per week
        <select value={value.daysPerWeek} onChange={set('daysPerWeek')}>
          {[3, 4, 5, 6, 7].map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </label>
      <label class="field">
        Long run day
        <select value={value.longRunDay} onChange={set('longRunDay')}>
          {WEEKDAY_LONG_NAMES.map((n, i) => (
            <option key={n} value={i}>{n}</option>
          ))}
        </select>
      </label>
      <label class="field">
        Peak weekly volume (km)
        <span class="hint">The most you want to run in the biggest week.</span>
        <input type="number" min="10" step="5" inputMode="decimal" value={value.peakWeeklyKm} onInput={set('peakWeeklyKm')} required />
      </label>
      <label class="field">
        Recent race (for paces)
        <span class="hint">Optional. Distance and finish time, e.g. 10 km in 48:30.</span>
        <div class="row" style={{ gap: 6 }}>
          <select value={value.refDistanceKm} onChange={set('refDistanceKm')} style={{ flex: 1 }}>
            {DISTANCE_PRESETS.map((p) => (
              <option key={p.km} value={p.km}>{p.label}</option>
            ))}
          </select>
          <input type="text" placeholder="h:mm:ss" value={value.refTime} onInput={set('refTime')} style={{ flex: 1 }} aria-label="Reference race time" />
        </div>
      </label>
    </div>
  );
}

export interface GoalFormValue {
  date: string;
  distanceKm: string;
  targetTime: string;
  name: string;
}

export function goalToForm(g?: Goal): GoalFormValue {
  return {
    date: g?.date ?? '',
    distanceKm: g ? String(g.distanceKm) : '42.195',
    targetTime: g?.targetTimeSec ? formatDuration(g.targetTimeSec) : '',
    name: g?.name ?? '',
  };
}

export function formToGoal(f: GoalFormValue): Goal | string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) return 'Pick a race date.';
  const distanceKm = Number(f.distanceKm);
  if (!(distanceKm > 0)) return 'Race distance must be positive.';
  const goal: Goal = { date: f.date, distanceKm };
  if (f.targetTime.trim()) {
    const t = parseDuration(f.targetTime);
    if (t === undefined) return 'Target time must look like 3:45:00.';
    goal.targetTimeSec = t;
  }
  if (f.name.trim()) goal.name = f.name.trim();
  return goal;
}

export function GoalFields({ value, onChange }: { value: GoalFormValue; onChange: (v: GoalFormValue) => void }) {
  const set = (k: keyof GoalFormValue) => (e: Event) => onChange({ ...value, [k]: (e.currentTarget as HTMLInputElement).value });
  return (
    <div class="grid">
      <label class="field">
        Race date
        <input type="date" value={value.date} onInput={set('date')} required />
      </label>
      <label class="field">
        Distance
        <select value={value.distanceKm} onChange={set('distanceKm')}>
          {DISTANCE_PRESETS.map((p) => (
            <option key={p.km} value={p.km}>{p.label}</option>
          ))}
        </select>
      </label>
      <label class="field">
        Target time
        <span class="hint">Optional, e.g. 3:45:00.</span>
        <input type="text" placeholder="h:mm:ss" value={value.targetTime} onInput={set('targetTime')} />
      </label>
      <label class="field">
        Race name
        <input type="text" placeholder="e.g. Berlin Marathon" value={value.name} onInput={set('name')} />
      </label>
    </div>
  );
}

/** Small helper hook for form state with an error line. */
export function useFormError(): [string | null, (e: string | null) => void] {
  return useState<string | null>(null);
}
