import { useState } from 'preact/hooks';
import { downloadText, exportJson, importJson } from '@/io/json';
import { scheduleToIcs } from '@/io/ics';
import { formatDuration, formatPaceRange } from '@/planner/paces';
import { loadError, replaceState, resetPlan, schedule, state, todayDate, updateAthlete, updateGoal } from '@/store/state';
import { AthleteFields, athleteToForm, formToAthlete, formToGoal, GoalFields, goalToForm } from './forms';
import { navigate } from './router';

export function SettingsView() {
  const s = state.value!;
  const sched = schedule.value!;
  return (
    <div class="stack">
      <GoalSettings key={s.goal.date + (s.goal.name ?? '')} />
      <AthleteSettings key={JSON.stringify(s.athlete)} />
      {sched.paces && (
        <div class="card">
          <h2>Training paces</h2>
          <p class="muted">Derived from your reference race (VDOT {sched.paces.vdot.toFixed(1)}). Predicted marathon: {formatDuration(sched.paces.predictedGoalTimeSec)}.</p>
          <table class="weeks">
            <tbody>
              <tr><td>Easy / long</td><td>{formatPaceRange(sched.paces.easy)}</td></tr>
              <tr><td>Marathon</td><td>{formatPaceRange(sched.paces.marathon)}</td></tr>
              <tr><td>Threshold (tempo)</td><td>{formatPaceRange(sched.paces.threshold)}</td></tr>
              <tr><td>Intervals</td><td>{formatPaceRange(sched.paces.interval)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
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
    <form class="card" onSubmit={save}>
      <h2>Goal race</h2>
      <GoalFields value={form} onChange={setForm} />
      {msg && <div class={`alert ${msg === 'Saved.' ? 'info' : 'danger'}`} style={{ marginTop: 12 }}>{msg}</div>}
      <div class="row" style={{ marginTop: 12 }}>
        <button class="btn primary" type="submit">Save goal</button>
      </div>
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
    <form class="card" onSubmit={save}>
      <h2>Athlete</h2>
      <AthleteFields value={form} onChange={setForm} />
      <label class="checks" style={{ marginTop: 12 }}>
        <label>
          <input type="checkbox" checked={rebaseline} onChange={(e) => setRebaseline((e.currentTarget as HTMLInputElement).checked)} />
          Treat the volume and longest run above as my fitness <em>now</em> (ignore older log weeks)
        </label>
      </label>
      {msg && <div class={`alert ${msg === 'Saved.' ? 'info' : 'danger'}`} style={{ marginTop: 12 }}>{msg}</div>}
      <div class="row" style={{ marginTop: 12 }}>
        <button class="btn primary" type="submit">Save athlete</button>
      </div>
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
    <div class="card">
      <h2>Data</h2>
      <p class="muted">Your plan lives only in this browser. Export a backup before clearing site data or switching devices.</p>
      <div class="row">
        <button class="btn" type="button" onClick={() => downloadText(`running-planner-${todayDate.value}.json`, exportJson(s))}>Export backup (JSON)</button>
        <label class="btn">
          Import backup
          <input type="file" accept="application/json,.json" onChange={onImport} class="sr-only" />
        </label>
        <button class="btn" type="button" onClick={() => downloadText('running-plan.ics', scheduleToIcs(sched), 'text/calendar')}>Export calendar (.ics)</button>
      </div>
      {err && (
        <div class="row" style={{ marginTop: 12 }}>
          <button class="btn" type="button" onClick={() => downloadText('running-planner-unreadable.json', err.raw)}>Download unreadable stored data</button>
        </div>
      )}
      {msg && <div class={`alert ${msg.startsWith('Import failed') ? 'danger' : 'info'}`} style={{ marginTop: 12 }}>{msg}</div>}
      <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />
      {!confirmReset ? (
        <button class="btn danger" type="button" onClick={() => setConfirmReset(true)}>Delete plan and start over</button>
      ) : (
        <div class="row">
          <span>Delete everything, including your log?</span>
          <button class="btn danger" type="button" onClick={() => { resetPlan(); navigate('week'); }}>Yes, delete</button>
          <button class="btn" type="button" onClick={() => setConfirmReset(false)}>Cancel</button>
        </div>
      )}
      <p class="muted" style={{ marginTop: 16 }}>
        Version {__APP_VERSION__} · <a href="https://github.com/elKei24/running-planner" target="_blank" rel="noreferrer">Source on GitHub</a>
      </p>
    </div>
  );
}
