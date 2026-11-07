import { useState } from 'preact/hooks';
import { formatDate } from '@/domain/dates';
import { rpeLabel } from '@/domain/rpe';
import type { LogEntry } from '@/domain/types';
import { parseActivity } from '@/io/gpx';
import { formatDuration } from '@/planner/paces';
import { state, todayDate } from '@/store/state';
import { km } from './format';
import { LogDialog } from './LogDialog';

interface Editing {
  date: string;
  entry?: LogEntry;
  initial?: { distanceKm?: number; durationSec?: number; note?: string };
}

export function LogView() {
  const s = state.value!;
  const [editing, setEditing] = useState<Editing | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const onImport = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const parsed = parseActivity(await file.text(), file.name);
      setImportError(null);
      setEditing({
        date: parsed.date && parsed.date <= todayDate.value ? parsed.date : todayDate.value,
        initial: { distanceKm: parsed.distanceKm, ...(parsed.durationSec ? { durationSec: parsed.durationSec } : {}), note: file.name.replace(/\.(gpx|tcx)$/i, '') },
      });
    } catch (ex) {
      setImportError(ex instanceof Error ? ex.message : String(ex));
    } finally {
      input.value = '';
    }
  };
  const entries = [...s.log].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const total = entries.reduce((a, e) => a + (e.skipped ? 0 : e.distanceKm), 0);

  return (
    <div class="stack">
      <div class="card">
        <div class="row between">
          <div>
            <h2>Training log</h2>
            <span class="muted">{entries.filter((e) => !e.skipped).length} runs · {km(Math.round(total * 10) / 10)}</span>
          </div>
          <div class="row">
            <label class="btn">
              Import GPX/TCX
              <input type="file" accept=".gpx,.tcx,application/gpx+xml" onChange={onImport} class="sr-only" />
            </label>
            <button class="btn primary" type="button" onClick={() => setEditing({ date: todayDate.value })}>+ Log a run</button>
          </div>
        </div>
        <div class="muted" style={{ marginTop: 8 }}>
          Ran a race you had not planned? <a href="#/events">Add it as a past race</a> to log the result and get the recovery days.
        </div>
        {importError && <div class="alert danger" style={{ marginTop: 12 }}>{importError}</div>}
      </div>
      <div class="list">
        {entries.length === 0 && <p class="empty">Nothing logged yet. Runs you log here (or from the week view) shape the plan going forward.</p>}
        {entries.map((e) => (
          <div key={e.id} class="item">
            <div>
              <strong>{formatDate(e.date, { weekday: true, year: true })}</strong>
              <div class="muted">
                {e.skipped ? 'Skipped' : `${km(e.distanceKm)}${e.durationSec ? ` · ${formatDuration(e.durationSec)}` : ''}${e.rpe ? ` · RPE ${e.rpe} (${rpeLabel(e.rpe).toLowerCase()})` : ''}`}
                {e.note ? ` · ${e.note}` : ''}
              </div>
            </div>
            <button class="btn small" type="button" onClick={() => setEditing({ date: e.date, entry: e })}>Edit</button>
          </div>
        ))}
      </div>
      {editing && <LogDialogWithDate date={editing.date} entry={editing.entry} initial={editing.initial} onClose={() => setEditing(null)} />}
    </div>
  );
}

function LogDialogWithDate({ date, entry, initial, onClose }: Editing & { onClose: () => void }) {
  const [d, setD] = useState(date);
  if (entry) return <LogDialog date={date} existing={entry} onClose={onClose} />;
  return (
    <div>
      <div class="card tight">
        <label class="field">
          Date
          <input type="date" value={d} max={todayDate.value} onInput={(e) => setD((e.currentTarget as HTMLInputElement).value)} />
        </label>
      </div>
      <LogDialog key={d} date={d} initial={initial} onClose={onClose} />
    </div>
  );
}
