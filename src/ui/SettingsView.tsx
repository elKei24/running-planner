import { useState } from 'preact/hooks';
import { weeksBetween } from '@/domain/dates';
import { expectedHr, formatHrRange, HR_ZONES } from '@/domain/heartRate';
import { downloadText, exportJson, importJson } from '@/io/json';
import { scheduleToIcs } from '@/io/ics';
import { formatDuration } from '@/planner/paces';
import { loadError, replaceState, resetPlan, schedule, setUnits, state, todayDate, updateAthlete, updateGoal } from '@/store/state';
import { paceRange } from './format';
import { AthleteFields, athleteToForm, formToAthlete, formToGoal, GoalFields, goalToForm } from './forms';
import { navigate } from './router';

export function SettingsView() {
  const s = state.value!;
  const sched = schedule.value!;
  return (
    <div class="stack">
      <GoalSettings key={s.goal.date + (s.goal.name ?? '')} />
      <AthleteSettings key={JSON.stringify(s.athlete)} />
      {s.athlete.maxHr && (
        <div class="card">
          <h2>Heart-rate zones</h2>
          <p class="muted">Based on your max heart rate of {s.athlete.maxHr} bpm. Guidance only: heart rate lags at the start of a session and drifts up in heat and over long runs, so trust pace and feel when they disagree.</p>
          <table class="paces">
            <tbody>
              {HR_ZONES.map((z) => (
                <tr key={z.label}><td>{z.label}</td><td>{formatHrRange(expectedHr(z.types[0]!, s.athlete.maxHr!)!)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {sched.paces && (
        <div class="card">
          <h2>Training paces</h2>
          <p class="muted">Derived from your reference race (VDOT {sched.paces.vdot.toFixed(1)}). Predicted marathon: {formatDuration(sched.paces.predictedGoalTimeSec)}.</p>
          <table class="paces">
            <tbody>
              <tr><td>Easy / long</td><td>{paceRange(sched.paces.easy)}</td></tr>
              <tr><td>Marathon</td><td>{paceRange(sched.paces.marathon)}</td></tr>
              <tr><td>Threshold (tempo)</td><td>{paceRange(sched.paces.threshold)}</td></tr>
              <tr><td>Intervals</td><td>{paceRange(sched.paces.interval)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
      <div class="card stack">
        <h2>Display</h2>
        <div class="checks segmented" role="radiogroup" aria-label="Units">
          <label>
            <input type="radio" name="units" checked={s.prefs.units === 'km'} onChange={() => setUnits('km')} /> Kilometres
          </label>
          <label>
            <input type="radio" name="units" checked={s.prefs.units === 'mi'} onChange={() => setUnits('mi')} /> Miles
          </label>
        </div>
        <p class="muted">Inputs are always in kilometres; this changes how distances and paces are shown.</p>
      </div>
      <DataSettings />
    </div>
  );
}

function GoalSettings() {
  const s = state.value!;
  const [form, setForm] = useState(goalToForm(s.goal));
  const [msg, setMsg] = useState<string | null>(null);
  const save = (e: Event) => {
    e.preventDefault();
    const g = formToGoal(form);
    if (typeof g === 'string') return setMsg(g);
    updateGoal(g);
    setMsg('Saved.');
  };
  return (
    <form class="card stack" onSubmit={save}>
      <h2>Goal race</h2>
      <GoalFields value={form} onChange={setForm} />
      {msg && <div class={`alert ${msg === 'Saved.' ? 'info' : 'danger'}`}>{msg}</div>}
      <button class="btn primary" type="submit">Save goal</button>
    </form>
  );
}

function AthleteSettings() {
  const s = state.value!;
  const [form, setForm] = useState(athleteToForm(s.athlete));
  const [rebaseline, setRebaseline] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const save = (e: Event) => {
    e.preventDefault();
    const a = formToAthlete(form);
    if (typeof a === 'string') return setMsg(a);
    updateAthlete(a, rebaseline);
    setMsg('Saved.');
  };
  return (
    <form class="card stack" onSubmit={save}>
      <h2>Athlete</h2>
      <AthleteFields value={form} onChange={setForm} goalKm={s.goal.distanceKm} weeksToRace={weeksBetween(todayDate.value, s.goal.date)} />
      <div class="checks">
        <label>
          <input type="checkbox" checked={rebaseline} onChange={(e) => setRebaseline((e.currentTarget as HTMLInputElement).checked)} />
          <span>
            Treat the volume and longest run above as my fitness <em>now</em> (ignore older log weeks)
          </span>
        </label>
      </div>
      {msg && <div class={`alert ${msg === 'Saved.' ? 'info' : 'danger'}`}>{msg}</div>}
      <button class="btn primary" type="submit">Save athlete</button>
    </form>
  );
}

function DataSettings() {
  const s = state.value!;
  const sched = schedule.value!;
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const err = loadError.value;

  const onImport = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      replaceState(importJson(await file.text()));
      setMsg('Imported.');
      navigate('week');
    } catch (ex) {
      setMsg(`Import failed: ${ex instanceof Error ? ex.message : String(ex)}`);
    } finally {
      input.value = '';
    }
  };

  return (
    <div class="card stack">
      <h2>Data</h2>
      <p class="muted">Your plan lives only in this browser. Export a backup before clearing site data or switching devices.</p>
      <div class="row">
        <button class="btn" type="button" onClick={() => downloadText(`running-planner-${todayDate.value}.json`, exportJson(s))}>Export backup (JSON)</button>
        <label class="btn">
          Import backup
          <input type="file" accept="application/json,.json" onChange={onImport} class="sr-only" />
        </label>
        <button class="btn" type="button" onClick={() => downloadText('running-plan.ics', scheduleToIcs(sched, s.prefs.units, undefined, s.athlete.maxHr), 'text/calendar')}>Export calendar (.ics)</button>
      </div>
      {err && (
        <div class="row">
          <button class="btn" type="button" onClick={() => downloadText('running-planner-unreadable.json', err.raw)}>Download unreadable stored data</button>
        </div>
      )}
      {msg && <div class={`alert ${msg.startsWith('Import failed') ? 'danger' : 'info'}`}>{msg}</div>}
      <hr class="rule" />
      {!confirmReset ? (
        <button class="btn danger" type="button" onClick={() => setConfirmReset(true)}>Delete plan and start over</button>
      ) : (
        <div class="row">
          <span>Delete everything, including your log?</span>
          <button class="btn danger" type="button" onClick={() => { resetPlan(); navigate('week'); }}>Yes, delete</button>
          <button class="btn" type="button" onClick={() => setConfirmReset(false)}>Cancel</button>
        </div>
      )}
      <p class="footnote">
        Version {__APP_VERSION__} · <a href="https://github.com/elKei24/running-planner" target="_blank" rel="noreferrer">Source on GitHub</a>
      </p>
    </div>
  );
}
