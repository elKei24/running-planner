import { useState } from 'preact/hooks';
import { addDays, weeksBetween } from '@/domain/dates';
import { FAST_STRATEGY_MIN_WEEKS } from '@/planner/periodize';
import { createPlan, todayDate } from '@/store/state';
import { AthleteFields, athleteToForm, defaultPeak, formToAthlete, formToGoal, GoalFields, goalToForm, useFormError } from './forms';
import type { AthleteFormValue, GoalFormValue } from './forms';

export function Setup() {
  const [athlete, setAthlete] = useState<AthleteFormValue>(athleteToForm());
  const [goal, setGoal] = useState<GoalFormValue>({ ...goalToForm(), date: addDays(todayDate.value, 16 * 7) });
  const [error, setError] = useFormError();
  const [peakTouched, setPeakTouched] = useState(false);
  const [strategyTouched, setStrategyTouched] = useState(false);
  const weeksToRace = /^\d{4}-\d{2}-\d{2}$/.test(goal.date) ? weeksBetween(todayDate.value, goal.date) : undefined;

  const onAthlete = (v: AthleteFormValue) => {
    const touched = peakTouched || v.peakWeeklyKm !== athlete.peakWeeklyKm;
    setPeakTouched(touched);
    if (v.buildStrategy !== athlete.buildStrategy) setStrategyTouched(true);
    setAthlete(touched ? v : { ...v, peakWeeklyKm: String(defaultPeak(Number(v.weeklyKmRecent) || 0, Number(v.daysPerWeek) || 4)) });
  };

  // Long horizons default to "build fast, then maintain" until the athlete picks explicitly.
  const onGoal = (g: GoalFormValue) => {
    setGoal(g);
    if (!strategyTouched && /^\d{4}-\d{2}-\d{2}$/.test(g.date)) {
      const weeks = weeksBetween(todayDate.value, g.date);
      setAthlete((a) => ({ ...a, buildStrategy: weeks >= FAST_STRATEGY_MIN_WEEKS ? 'fast' : 'steady' }));
    }
  };

  const submit = (e: Event) => {
    e.preventDefault();
    const a = formToAthlete(athlete);
    if (typeof a === 'string') return setError(a);
    const g = formToGoal(goal);
    if (typeof g === 'string') return setError(g);
    if (g.date < todayDate.value) return setError('The race date is in the past.');
    setError(null);
    createPlan(a, g);
  };

  return (
    <form onSubmit={submit} class="stack">
      <div class="hero">
        <span class="eyebrow">No account · no server · adapts every week</span>
        <h1>Plan your race</h1>
        <p>
          Everything stays in this browser. The plan is recomputed from your goal, your log and your calendar every time you open the app, so skipped
          weeks, holidays and tune-up races are handled automatically.
        </p>
      </div>
      <div class="card step">
        <span class="no" aria-hidden="true">1</span>
        <div>
          <h2>Your goal</h2>
          <GoalFields value={goal} onChange={onGoal} />
        </div>
      </div>
      <div class="card step">
        <span class="no" aria-hidden="true">2</span>
        <div>
          <h2>Where you are now</h2>
          <AthleteFields value={athlete} onChange={onAthlete} goalKm={Number(goal.distanceKm) || 42.195} weeksToRace={weeksToRace} />
        </div>
      </div>
      {error && <div class="alert danger" role="alert">{error}</div>}
      <div class="row">
        <button class="btn primary large" type="submit">Create my plan</button>
      </div>
    </form>
  );
}
