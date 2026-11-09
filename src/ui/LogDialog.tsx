import { useEffect, useRef, useState } from 'preact/hooks';
import { expectedRpe, RPE_SCALE } from '@/domain/rpe';
import type { LogEntry, Session } from '@/domain/types';
import { formatDuration, parseDuration } from '@/planner/paces';
import { logRun, removeLog, todayDate } from '@/store/state';
import { durationInput } from './format';

export interface LogDialogProps {
  date: string;
  session?: Session;
  existing?: LogEntry;
  /** Pre-filled values, e.g. from an imported GPX file. */
  initial?: { distanceKm?: number; durationSec?: number; note?: string };
  /** Let the athlete pick the day inside the dialog. Always on when editing an existing entry. */
  editableDate?: boolean;
  onClose: () => void;
}

export function LogDialog({ date: initialDate, session, existing, initial, editableDate: editableDateProp = false, onClose }: LogDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [date, setDate] = useState(initialDate);
  const editableDate = editableDateProp || !!existing;
  const [distance, setDistance] = useState(
    existing ? String(existing.distanceKm) : initial?.distanceKm ? String(initial.distanceKm) : session && session.distanceKm > 0 ? String(session.distanceKm) : '',
  );
  const [duration, setDuration] = useState(existing?.durationSec ? formatDuration(existing.durationSec) : initial?.durationSec ? formatDuration(initial.durationSec) : '');
  const [rpe, setRpe] = useState(existing?.rpe ? String(existing.rpe) : '');
  const [note, setNote] = useState(existing?.note ?? initial?.note ?? '');
  const [skipped, setSkipped] = useState(existing?.skipped ?? false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    }
    return () => {
      if (d && typeof d.close === 'function') d.close();
    };
  }, []);

  const save = (e: Event) => {
    e.preventDefault();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Pick the day you ran.');
    if (date > todayDate.value) return setError('You cannot log a run in the future.');
    const entry: Omit<LogEntry, 'id'> & { id?: string } = { date, distanceKm: 0 };
    if (existing) entry.id = existing.id;
    if (skipped) {
      entry.skipped = true;
    } else {
      const km = Number(distance);
      if (!(km > 0)) return setError('Enter the distance you ran.');
      entry.distanceKm = km;
      if (duration.trim()) {
        const sec = parseDuration(duration);
        if (sec === undefined) return setError('Duration must look like 45:30 or 1:45:00.');
        entry.durationSec = sec;
      }
      if (rpe) entry.rpe = Number(rpe);
    }
    if (note.trim()) entry.note = note.trim();
    logRun(entry);
    onClose();
  };

  const remove = () => {
    if (existing) removeLog(existing.id);
    onClose();
  };

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="log-title">
      <form onSubmit={save} class="stack">
        <h2 id="log-title">{existing ? 'Edit run' : 'Log run'}{editableDate ? '' : ` · ${date}`}</h2>
        {editableDate && (
          <label class="field">
            Date
            <input type="date" value={date} max={todayDate.value} onInput={(e) => setDate((e.currentTarget as HTMLInputElement).value)} aria-label="Run date" required />
          </label>
        )}
        {session && session.distanceKm > 0 && <p class="muted">Planned: {session.title}</p>}
        <div class="checks">
          <label>
            <input type="checkbox" checked={skipped} onChange={(e) => setSkipped((e.currentTarget as HTMLInputElement).checked)} /> I skipped this day
          </label>
        </div>
        {!skipped && (
          <div class="grid">
            <label class="field">
              Distance (km)
              <input type="number" min="0" step="0.1" inputMode="decimal" value={distance} onInput={(e) => setDistance((e.currentTarget as HTMLInputElement).value)} autoFocus />
            </label>
            <label class="field">
              Duration
              <input
                type="text"
                inputMode="numeric"
                placeholder="hh:mm:ss"
                value={duration}
                onInput={(e) => {
                  const input = e.currentTarget as HTMLInputElement;
                  // Write back directly as well: an ignored keystroke leaves the state unchanged and would not re-render.
                  input.value = durationInput(input.value);
                  setDuration(input.value);
                }}
              />
            </label>
            <label class="field">
              Effort (RPE 1–10)
              {session && expectedRpe(session.type) && (
                <span class="hint">
                  This {session.type === 'marathonPace' ? 'marathon-pace' : session.type} session should feel like {expectedRpe(session.type)![0]}–{expectedRpe(session.type)![1]}.
                </span>
              )}
              <select value={rpe} onChange={(e) => setRpe((e.currentTarget as HTMLSelectElement).value)} aria-describedby="rpe-meaning">
                <option value="">–</option>
                {RPE_SCALE.map((r) => (
                  <option key={r.value} value={r.value}>{r.value} · {r.label}</option>
                ))}
              </select>
              <span class="hint" id="rpe-meaning">
                {rpe ? RPE_SCALE.find((r) => String(r.value) === rpe)?.meaning : 'How hard it felt overall. 3 is conversational, 7 is tempo, 10 is all-out.'}
              </span>
            </label>
          </div>
        )}
        <label class="field">
          Note
          <input type="text" value={note} onInput={(e) => setNote((e.currentTarget as HTMLInputElement).value)} placeholder="How did it feel?" />
        </label>
        {error && <div class="alert danger">{error}</div>}
        <div class="row between">
          <div class="row">
            <button class="btn primary" type="submit">Save</button>
            <button class="btn" type="button" onClick={onClose}>Cancel</button>
          </div>
          {existing && (
            <button class="btn danger small" type="button" onClick={remove}>Delete</button>
          )}
        </div>
      </form>
    </dialog>
  );
}
