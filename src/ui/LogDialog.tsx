import { useEffect, useRef, useState } from 'preact/hooks';
import type { LogEntry, Session } from '@/domain/types';
import { formatDuration, parseDuration } from '@/planner/paces';
import { logRun, removeLog } from '@/store/state';

export interface LogDialogProps {
  date: string;
  session?: Session;
  existing?: LogEntry;
  onClose: () => void;
}

export function LogDialog({ date, session, existing, onClose }: LogDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [distance, setDistance] = useState(existing ? String(existing.distanceKm) : session && session.distanceKm > 0 ? String(session.distanceKm) : '');
  const [duration, setDuration] = useState(existing?.durationSec ? formatDuration(existing.durationSec) : '');
  const [rpe, setRpe] = useState(existing?.rpe ? String(existing.rpe) : '');
  const [note, setNote] = useState(existing?.note ?? '');
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
        <h2 id="log-title">{existing ? 'Edit run' : 'Log run'} · {date}</h2>
        {session && session.distanceKm > 0 && <p class="muted">Planned: {session.title}</p>}
        <label class="checks">
          <label>
            <input type="checkbox" checked={skipped} onChange={(e) => setSkipped((e.currentTarget as HTMLInputElement).checked)} /> I skipped this day
          </label>
        </label>
        {!skipped && (
          <div class="grid">
            <label class="field">
              Distance (km)
              <input type="number" min="0" step="0.1" inputMode="decimal" value={distance} onInput={(e) => setDistance((e.currentTarget as HTMLInputElement).value)} autoFocus />
            </label>
            <label class="field">
              Duration
              <input type="text" placeholder="h:mm:ss" value={duration} onInput={(e) => setDuration((e.currentTarget as HTMLInputElement).value)} />
            </label>
            <label class="field">
              Effort (RPE 1–10)
              <select value={rpe} onChange={(e) => setRpe((e.currentTarget as HTMLSelectElement).value)}>
                <option value="">–</option>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
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
