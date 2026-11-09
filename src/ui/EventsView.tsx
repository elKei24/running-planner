import { useState } from 'preact/hooks';
import { formatDate, startOfWeek, WEEKDAY_NAMES } from '@/domain/dates';
import type { Weekday } from '@/domain/dates';
import type { PlanEvent } from '@/domain/types';
import { formatDuration } from '@/planner/paces';
import { addEvent, entriesOn, removeEvent, state, todayDate, updateAthlete } from '@/store/state';
import { DISTANCE_PRESETS, km, loggedPace } from './format';
import { DistanceField } from './forms';

type Tab = 'race' | 'block' | 'availability';

export function EventsView() {
  const s = state.value!;
  const [tab, setTab] = useState<Tab>('race');
  const events = [...s.events].sort((a, b) => (eventDate(a) < eventDate(b) ? -1 : 1));
  return (
    <div class="stack">
      <div class="card stack">
        <h2>Races, breaks and availability</h2>
        <p class="muted">Anything you add here is folded into the plan immediately: tune-up races get a mini taper and recovery, blocked days are removed and the volume re-ramps afterwards.</p>
        <div class="checks segmented" role="tablist">
          {(['race', 'block', 'availability'] as Tab[]).map((t) => (
            <label key={t}>
              <input type="radio" name="tab" checked={tab === t} onChange={() => setTab(t)} /> {t === 'race' ? 'Tune-up race' : t === 'block' ? 'Break / injury' : 'Week availability'}
            </label>
          ))}
        </div>
        {tab === 'race' && <RaceForm />}
        {tab === 'block' && <BlockForm />}
        {tab === 'availability' && <AvailabilityForm />}
      </div>
      <div class="list">
        {events.length === 0 && <p class="empty">No events yet.</p>}
        {events.map((e) => (
          <div key={e.id} class="item">
            <div>
              <strong>{describe(e)}</strong>
              <div class="muted">{detail(e)}</div>
              {e.kind === 'race' && e.date <= todayDate.value && <RaceResult race={e} />}
            </div>
            <button class="btn small danger" type="button" onClick={() => removeEvent(e.id)}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** For a past race: the logged result, and a shortcut to use it as the reference race for paces. */
function RaceResult({ race }: { race: Extract<PlanEvent, { kind: 'race' }> }) {
  const s = state.value!;
  const result = entriesOn(s, race.date).find((l) => !l.skipped && l.durationSec);
  if (!result) return <div class="muted">No result logged yet.</div>;
  const ref = s.athlete.referenceRace;
  const isReference = !!ref && Math.abs(ref.distanceKm - race.distanceKm) < 0.01 && ref.timeSec === result.durationSec;
  return (
    <div class="muted">
      Result: {km(result.distanceKm)} in {formatDuration(result.durationSec!)} ({loggedPace(result)})
      {isReference ? (
        ' · used for your paces'
      ) : (
        <>
          {' · '}
          <button class="btn small ghost" type="button" onClick={() => updateAthlete({ ...s.athlete, referenceRace: { distanceKm: race.distanceKm, timeSec: result.durationSec! } }, false)}>
            Use for paces
          </button>
        </>
      )}
    </div>
  );
}

function eventDate(e: PlanEvent): string {
  return e.kind === 'race' ? e.date : e.kind === 'block' ? e.from : e.weekOf;
}

function describe(e: PlanEvent): string {
  switch (e.kind) {
    case 'race':
      return `${e.name ?? DISTANCE_PRESETS.find((p) => Math.abs(p.km - e.distanceKm) < 0.01)?.label ?? `${e.distanceKm} km race`} (${e.priority === 'B' ? 'tune-up' : 'low-key'})`;
    case 'block':
      return `${e.reason[0]!.toUpperCase()}${e.reason.slice(1)}`;
    case 'availability':
      return 'Custom availability';
  }
}

function detail(e: PlanEvent): string {
  switch (e.kind) {
    case 'race':
      return `${formatDate(e.date, { weekday: true, year: true })} · ${e.distanceKm} km`;
    case 'block':
      return e.from === e.to ? formatDate(e.from, { weekday: true, year: true }) : `${formatDate(e.from, { weekday: true })} – ${formatDate(e.to, { weekday: true, year: true })}${e.note ? ` · ${e.note}` : ''}`;
    case 'availability':
      return `Week of ${formatDate(e.weekOf, { year: true })}: ${e.days.map((d) => WEEKDAY_NAMES[d]).join(', ') || 'no days'}`;
  }
}

function RaceForm() {
  const [date, setDate] = useState('');
  const [distance, setDistance] = useState('10');
  const [priority, setPriority] = useState<'B' | 'C'>('B');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = (e: Event) => {
    e.preventDefault();
    if (!date) return setError('Pick a date.');
    if (date < todayDate.value) return setError('The race is in the past. Log it as a run instead (Log → Log a run).');
    const distanceKm = Number(distance);
    if (!(distanceKm > 0)) return setError('Enter the race distance in km.');
    addEvent({ kind: 'race', date, distanceKm, priority, ...(name.trim() ? { name: name.trim() } : {}) });
    setDate('');
    setName('');
    setError(null);
  };
  return (
    <form onSubmit={submit} class="stack">
      <div class="grid">
        <label class="field">Date<input type="date" value={date} onInput={(e) => setDate((e.currentTarget as HTMLInputElement).value)} required /></label>
        <div class="field">
          Distance
          <DistanceField value={distance} onChange={setDistance} label="Tune-up race distance" max={42} />
        </div>
        <label class="field">
          How seriously?
          <select value={priority} onChange={(e) => setPriority((e.currentTarget as HTMLSelectElement).value as 'B' | 'C')}>
            <option value="B">Tune-up: race it (mini taper + recovery)</option>
            <option value="C">Low-key: just a hard workout</option>
          </select>
        </label>
        <label class="field">Name<input type="text" value={name} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} placeholder="optional" /></label>
      </div>
      {error && <div class="alert danger">{error}</div>}
      <button class="btn primary" type="submit">Add race</button>
    </form>
  );
}

function BlockForm() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState<'vacation' | 'injury' | 'illness' | 'other'>('vacation');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = (e: Event) => {
    e.preventDefault();
    const end = to || from;
    if (!from) return setError('Pick a start date.');
    if (end < from) return setError('End must be after start.');
    addEvent({ kind: 'block', from, to: end, reason, ...(note.trim() ? { note: note.trim() } : {}) });
    setFrom('');
    setTo('');
    setNote('');
    setError(null);
  };
  return (
    <form onSubmit={submit} class="stack">
      <div class="grid">
        <label class="field">From<input type="date" value={from} onInput={(e) => setFrom((e.currentTarget as HTMLInputElement).value)} required /></label>
        <label class="field">To<span class="hint">Leave empty for a single day.</span><input type="date" value={to} onInput={(e) => setTo((e.currentTarget as HTMLInputElement).value)} /></label>
        <label class="field">
          Reason
          <select value={reason} onChange={(e) => setReason((e.currentTarget as HTMLSelectElement).value as typeof reason)}>
            <option value="vacation">Vacation / travel</option>
            <option value="injury">Injury</option>
            <option value="illness">Illness</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label class="field">Note<input type="text" value={note} onInput={(e) => setNote((e.currentTarget as HTMLInputElement).value)} placeholder="optional" /></label>
      </div>
      {error && <div class="alert danger">{error}</div>}
      <button class="btn primary" type="submit">Block these days</button>
    </form>
  );
}

function AvailabilityForm() {
  const [weekOf, setWeekOf] = useState(startOfWeek(todayDate.value));
  const [days, setDays] = useState<Weekday[]>([1, 3, 6]);
  const toggle = (d: Weekday) => setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d].sort((a, b) => a - b)));
  const submit = (e: Event) => {
    e.preventDefault();
    const monday = startOfWeek(weekOf);
    const existing = state.value!.events.find((ev) => ev.kind === 'availability' && ev.weekOf === monday);
    if (existing) removeEvent(existing.id);
    addEvent({ kind: 'availability', weekOf: monday, days });
  };
  return (
    <form onSubmit={submit} class="stack">
      <label class="field">
        Week containing
        <input type="date" value={weekOf} onInput={(e) => setWeekOf((e.currentTarget as HTMLInputElement).value)} required />
      </label>
      <div class="field">
        Days I can run that week
        <div class="checks">
          {WEEKDAY_NAMES.map((n, i) => (
            <label key={n}>
              <input type="checkbox" checked={days.includes(i as Weekday)} onChange={() => toggle(i as Weekday)} /> {n}
            </label>
          ))}
        </div>
      </div>
      <button class="btn primary" type="submit">Save availability</button>
    </form>
  );
}
