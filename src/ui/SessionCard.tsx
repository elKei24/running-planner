import { formatDate, WEEKDAY_NAMES, weekday } from '@/domain/dates';
import type { LogEntry, Session } from '@/domain/types';
import { formatDuration, formatPaceRange } from '@/planner/paces';
import { km, TYPE_LABEL } from './format';

export type SessionStatus = 'planned' | 'today' | 'done' | 'missed' | 'skipped' | 'none';

export function sessionStatus(s: Session, entries: LogEntry[], today: string): SessionStatus {
  if (entries.some((e) => e.skipped)) return 'skipped';
  if (entries.some((e) => e.distanceKm > 0)) return 'done';
  if (s.distanceKm === 0) return 'none';
  if (s.date === today) return 'today';
  if (s.date < today) return 'missed';
  return 'planned';
}

export function SessionCard({ session, entries, today, onLog }: { session: Session; entries: LogEntry[]; today: string; onLog?: (s: Session) => void }) {
  const status = sessionStatus(session, entries, today);
  const logged = entries.reduce((a, e) => a + (e.skipped ? 0 : e.distanceKm), 0);
  const classes = ['session', session.date === today ? 'today' : '', status === 'done' ? 'done' : '', status === 'missed' ? 'past-missed' : ''].join(' ');
  return (
    <article class={classes} aria-label={`${formatDate(session.date, { weekday: true })}: ${session.title}`}>
      <div class="day">
        {WEEKDAY_NAMES[weekday(session.date)]}
        <small>{formatDate(session.date)}</small>
      </div>
      <div>
        <div class="title">
          <span class={`badge type-${session.type}`}>{TYPE_LABEL[session.type]}</span>
          <span>{session.title}</span>
          {session.adjusted && <span class="muted" title="Adjusted for an event">✎</span>}
        </div>
        {session.distanceKm > 0 && (
          <div class="meta">
            {km(session.distanceKm)}
            {session.pace ? ` · ${formatPaceRange(session.pace)}` : ''}
          </div>
        )}
        <div class="desc">{session.description}</div>
        {entries.length > 0 && (
          <div class="meta">
            {entries.map((e) => (
              <div key={e.id}>
                {e.skipped ? 'Skipped' : `Logged ${km(e.distanceKm)}${e.durationSec ? ` in ${formatDuration(e.durationSec)}` : ''}${e.rpe ? ` · RPE ${e.rpe}` : ''}`}
                {e.note ? ` · ${e.note}` : ''}
              </div>
            ))}
          </div>
        )}
      </div>
      <div class="actions">
        {status === 'done' && <span class="status done">✓ {km(logged)}</span>}
        {status === 'missed' && <span class="status missed">Missed</span>}
        {status === 'skipped' && <span class="status skipped">Skipped</span>}
        {onLog && session.date <= today && (
          <button class="btn small" type="button" onClick={() => onLog(session)}>
            {entries.length > 0 ? 'Edit' : 'Log'}
          </button>
        )}
      </div>
    </article>
  );
}
