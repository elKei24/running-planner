import { formatDate, WEEKDAY_NAMES, weekday } from '@/domain/dates';
import { rpeLabel } from '@/domain/rpe';
import type { LogEntry, Session } from '@/domain/types';
import { formatDuration } from '@/planner/paces';
import { km, paceRange, TYPE_LABEL } from './format';

export type SessionStatus = 'planned' | 'today' | 'done' | 'missed' | 'skipped' | 'none';

export function sessionStatus(s: Session, entries: LogEntry[], today: string): SessionStatus {
  if (entries.some((e) => e.skipped)) return 'skipped';
  if (entries.some((e) => e.distanceKm > 0)) return 'done';
  if (s.distanceKm === 0) return 'none';
  if (s.date === today) return 'today';
  if (s.date < today) return 'missed';
  return 'planned';
}

export interface SessionCardProps {
  session: Session;
  entries: LogEntry[];
  today: string;
  onLog?: (s: Session) => void;
  onExclude?: (s: Session) => void;
}

/** One day of the week, laid out as a stop on a timeline (day · rail · what · actions). */
export function SessionCard({ session, entries, today, onLog, onExclude }: SessionCardProps) {
  const status = sessionStatus(session, entries, today);
  const logged = entries.reduce((a, e) => a + (e.skipped ? 0 : e.distanceKm), 0);
  const classes = ['session', `type-${session.type}`, session.date === today ? 'today' : '', status === 'done' ? 'done' : '', status === 'missed' ? 'past-missed' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <article class={classes} aria-label={`${formatDate(session.date, { weekday: true })}: ${session.title}`}>
      <div class="day">
        <span class="dow">{WEEKDAY_NAMES[weekday(session.date)]}</span>
        <span class="dom">{Number(session.date.slice(8, 10))}</span>
      </div>
      <div class="rail" aria-hidden="true">
        <span class="dot" />
      </div>
      <div class="body">
        <div class="title">
          <span>{session.title}</span>
          <span class={`badge type-${session.type}`}>{TYPE_LABEL[session.type]}</span>
          {session.adjusted && <span class="muted" title="Adjusted for an event">✎</span>}
        </div>
        {session.distanceKm > 0 && (
          <div class="meta">
            {km(session.distanceKm)}
            {session.pace ? ` · ${paceRange(session.pace)}` : ''}
          </div>
        )}
        <div class="desc">{session.description}</div>
        {entries.length > 0 && (
          <div class="logged">
            {entries.map((e) => (
              <div key={e.id}>
                {e.skipped ? 'Skipped' : `Logged ${km(e.distanceKm)}${e.durationSec ? ` in ${formatDuration(e.durationSec)}` : ''}${e.rpe ? ` · RPE ${e.rpe} (${rpeLabel(e.rpe).toLowerCase()})` : ''}`}
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
        {onExclude && session.date > today && session.distanceKm > 0 && session.type !== 'race' && (
          <button class="btn small ghost" type="button" onClick={() => onExclude(session)} title="Re-plan this week without this day">
            Can't run
          </button>
        )}
      </div>
    </article>
  );
}
