import { useState } from 'preact/hooks';
import { WEEKDAY_LONG_NAMES } from '@/domain/dates';
import { MAX_MAX_HR, MIN_MAX_HR } from '@/domain/heartRate';
import type { Weekday } from '@/domain/dates';
import type { Athlete, Goal } from '@/domain/types';
import { formatDuration, parseDuration } from '@/planner/paces';
import { FAST_STRATEGY_MIN_WEEKS } from '@/planner/periodize';
import { peakLongRunKm } from '@/planner/template';
import { DISTANCE_PRESETS } from './format';

/**
 * Distance picker: the usual race distances plus a "Custom" option that
 * reveals a free km input. `value` is always the distance in km as a string.
 */
export function DistanceField({ value, onChange, label, max }: { value: string; onChange: (km: string) => void; label?: string; max?: number }) {
  const presets = DISTANCE_PRESETS.filter((p) => max === undefined || p.km <= max);
  const isPreset = presets.some((p) => String(p.km) === value);
  const [custom, setCustom] = useState(!isPreset);
  const selectValue = custom ? 'custom' : value;
  const onSelect = (e: Event) => {
    const v = (e.currentTarget as HTMLSelectElement).value;
    if (v === 'custom') {
      setCustom(true);
      if (isPreset) onChange('');
    } else {
      setCustom(false);
      onChange(v);
    }
  };
  return (
    <div class="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
      <select value={selectValue} onChange={onSelect} style={{ flex: 1 }} aria-label={label ?? 'Distance'}>
        {presets.map((p) => (
          <option key={p.km} value={p.km}>{p.label}</option>
        ))}
        <option value="custom">Custom…</option>
      </select>
      {custom && (
        <input
          type="number"
          min="0.5"
          max={max ?? 200}
          step="any"
          inputMode="decimal"
          placeholder="km"
          value={value}
          onInput={(e) => onChange((e.currentTarget as HTMLInputElement).value)}
          aria-label={`${label ?? 'Distance'} in km`}
          style={{ flex: 1 }}
        />
      )}
    </div>
  );
}

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
  buildStrategy: string;
  maxHr: string;
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
    buildStrategy: a?.buildStrategy ?? 'steady',
    maxHr: a?.maxHr ? String(a.maxHr) : '',
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
    buildStrategy: f.buildStrategy === 'fast' ? 'fast' : 'steady',
  };
  if (f.maxHr.trim()) {
    const maxHr = Number(f.maxHr);
    if (!(maxHr >= MIN_MAX_HR && maxHr <= MAX_MAX_HR)) return `Max heart rate must be between ${MIN_MAX_HR} and ${MAX_MAX_HR} bpm.`;
    athlete.maxHr = Math.round(maxHr);
  }
  if (f.refTime.trim()) {
    const timeSec = parseDuration(f.refTime);
    const distanceKm = Number(f.refDistanceKm);
    if (timeSec === undefined) return 'Reference race time must look like 48:30 or 1:45:00.';
    if (!(distanceKm > 0)) return 'Reference race distance must be positive.';
    athlete.referenceRace = { distanceKm, timeSec };
  }
  return athlete;
}

export function AthleteFields({ value, onChange, goalKm = 42.195, weeksToRace }: { value: AthleteFormValue; onChange: (v: AthleteFormValue) => void; goalKm?: number; weeksToRace?: number }) {
  const set = (k: keyof AthleteFormValue) => (e: Event) => onChange({ ...value, [k]: (e.currentTarget as HTMLInputElement).value });
  const peak = Number(value.peakWeeklyKm);
  const impliedLong = peak > 0 ? peakLongRunKm(peak, goalKm) : 0;
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
        <span class="hint">
          The most you want to run in the biggest week.
          {impliedLong > 0 ? ` At ${Math.round(peak)} km/week the longest run will be about ${impliedLong} km${goalKm > 40 && impliedLong < 28 ? ' (28–32 km is ideal for a marathon)' : ''}.` : ''}
        </span>
        <input type="number" min="10" step="5" inputMode="decimal" value={value.peakWeeklyKm} onInput={set('peakWeeklyKm')} required />
      </label>
      <label class="field">
        Build strategy
        <span class="hint">
          {weeksToRace !== undefined && weeksToRace >= FAST_STRATEGY_MIN_WEEKS
            ? `With ${weeksToRace} weeks, building fast then maintaining avoids a year-long trickle.`
            : `Only matters with ${FAST_STRATEGY_MIN_WEEKS}+ weeks to race day.`}
        </span>
        <select value={value.buildStrategy} onChange={set('buildStrategy')} aria-label="Build strategy">
          <option value="steady">Steady: spread the build over all the weeks</option>
          <option value="fast">Build fast, then maintain: peak volume in ~16 weeks, hold, 12-week marathon block</option>
        </select>
      </label>
      <label class="field">
        Max heart rate (bpm)
        <span class="hint">Optional. Planned runs then show a heart-rate range. If you do not know it, leave it empty: 220 minus age is often off by 10 or more.</span>
        <input type="number" min={MIN_MAX_HR} max={MAX_MAX_HR} step="1" inputMode="numeric" value={value.maxHr} onInput={set('maxHr')} aria-label="Max heart rate" />
      </label>
      <label class="field">
        Recent race (for paces)
        <span class="hint">Optional. Distance and finish time, e.g. 10 km in 48:30.</span>
        <div class="stack" style={{ gap: 6 }}>
          <DistanceField value={value.refDistanceKm} onChange={(km) => onChange({ ...value, refDistanceKm: km })} label="Reference race distance" />
          <input type="text" placeholder="h:mm:ss" value={value.refTime} onInput={set('refTime')} aria-label="Reference race time" />
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
      <div class="field">
        Distance
        <DistanceField value={value.distanceKm} onChange={(km) => onChange({ ...value, distanceKm: km })} label="Race distance" />
      </div>
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
