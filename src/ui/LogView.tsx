import { useState } from 'preact/hooks';
import { formatDate } from '@/domain/dates';
import type { LogEntry } from '@/domain/types';
import { formatDuration } from '@/planner/paces';
import { state, todayDate } from '@/store/state';
import { km } from './format';
import { LogDialog } from './LogDialog';

export function LogView() {
  const s = state.value!;
  const [editing, setEditing] = useState<{ date: string; entry?: LogEntry } | null>(null);
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
          <button class="btn primary" type="button" onClick={() => setEditing({ date: todayDate.value })}>+ Log a run</button>
        </div>
      </div>
      <div class="list">
        {entries.length === 0 && <p class="empty">Nothing logged yet. Runs you log here (or from the week view) shape the plan going forward.</p>}
        {entries.map((e) => (
          <div key={e.id} class="item">
            <div>
              <strong>{formatDate(e.date, { weekday: true, year: true })}</strong>
              <div class="muted">
                {e.skipped ? 'Skipped' : `${km(e.distanceKm)}${e.durationSec ? ` · ${formatDuration(e.durationSec)}` : ''}${e.rpe ? ` · RPE ${e.rpe}` : ''}`}
                {e.note ? ` · ${e.note}` : ''}
              </div>
            </div>
            <button class="btn small" type="button" onClick={() => setEditing({ date: e.date, entry: e })}>Edit</button>
          </div>
        ))}
      </div>
      {editing && <LogDialogWithDate date={editing.date} entry={editing.entry} onClose={() => setEditing(null)} />}
    </div>
  );
}

function LogDialogWithDate({ date, entry, onClose }: { date: string; entry?: LogEntry; onClose: () => void }) {
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
      <LogDialog key={d} date={d} onClose={onClose} />
    </div>
  );
}
