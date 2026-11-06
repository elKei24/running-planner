import { useState } from 'preact/hooks';
import { addDays } from '@/domain/dates';
import { createPlan, todayDate } from '@/store/state';
import { AthleteFields, athleteToForm, defaultPeak, formToAthlete, formToGoal, GoalFields, goalToForm, useFormError } from './forms';
import type { AthleteFormValue, GoalFormValue } from './forms';

export function Setup() {
  const [athlete, setAthlete] = useState<AthleteFormValue>(athleteToForm());
  const [goal, setGoal] = useState<GoalFormValue>({ ...goalToForm(), date: addDays(todayDate.value, 16 * 7) });
  const [error, setError] = useFormError();
  const [peakTouched, setPeakTouched] = useState(false);

  const onAthlete = (v: AthleteFormValue) => {
    const touched = peakTouched || v.peakWeeklyKm !== athlete.peakWeeklyKm;
    setPeakTouched(touched);
    setAthlete(touched ? v : { ...v, peakWeeklyKm: String(defaultPeak(Number(v.weeklyKmRecent) || 0, Number(v.daysPerWeek) || 4)) });
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
      <div class="card">
        <h1>Plan your marathon</h1>
        <p class="muted">
          Everything stays in this browser. The plan is recomputed from your goal, your log and your calendar every time you open the app, so skipped
          weeks, holidays and tune-up races are handled automatically.
        </p>
      </div>
      <div class="card">
        <h2>Your goal</h2>
        <GoalFields value={goal} onChange={setGoal} />
      </div>
      <div class="card">
        <h2>Where you are now</h2>
        <AthleteFields value={athlete} onChange={onAthlete} />
      </div>
      {error && <div class="alert danger" role="alert">{error}</div>}
      <button class="btn primary" type="submit">Create my plan</button>
    </form>
  );
}
