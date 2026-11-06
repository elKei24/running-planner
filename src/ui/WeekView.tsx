import { signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import { addDays, diffDays, formatDate, startOfWeek } from '@/domain/dates';
import type { LogEntry, Session, Week } from '@/domain/types';
import { formatDuration } from '@/planner/paces';
import { entriesOn, excludeDay, schedule, state, todayDate } from '@/store/state';
import { km, paceRange, PHASE_LABEL } from './format';
import { LogDialog } from './LogDialog';
import { SessionCard } from './SessionCard';
import { Warnings } from './Warnings';

/** Week currently shown; null means "the current week". Shared with the plan overview. */
export const selectedWeekStart = signal<string | null>(null);

export function WeekView() {
  const s = state.value!;
  const sched = schedule.value!;
  const today = todayDate.value;
  const anchor = startOfWeek(today);
  const [logging, setLogging] = useState<Session | null>(null);

  if (sched.weeks.length === 0) {
    return (
      <div class="card">
        <h2>No upcoming plan</h2>
        <Warnings warnings={sched.warnings} />
        <p>Set a new goal race in Settings to generate a fresh plan.</p>
      </div>
    );
  }

  const start = selectedWeekStart.value ?? anchor;
  const week = sched.weeks.find((w) => w.startDate === start) ?? sched.weeks[0]!;
  const idx = week.index;
  const go = (delta: number) => {
    const next = sched.weeks[idx + delta];
    if (next) selectedWeekStart.value = next.startDate;
  };
  const daysToRace = diffDays(today, s.goal.date);
  const entries = (date: string) => entriesOn(s, date);
  const logged = week.sessions.reduce((a, x) => a + entries(x.date).reduce((b, e) => b + (e.skipped ? 0 : e.distanceKm), 0), 0);
  const todaySession = week.sessions.find((x) => x.date === today);
  const exclude = (sess: Session) => {
    if (confirm(`Re-plan the week of ${formatDate(week.startDate)} without ${formatDate(sess.date, { weekday: true })}?`)) excludeDay(sess.date);
  };

  return (
    <div class="stack">
      {week.startDate === anchor && <Warnings warnings={sched.warnings} />}
      <Summary daysToRace={daysToRace} />
      {week.startDate === anchor && todaySession && <TodayCard session={todaySession} entries={entries(today)} onLog={() => setLogging(todaySession)} />}
      {week.startDate === anchor && <PlanHealth />}
      <div class="weeknav">
        <button class="btn small" type="button" onClick={() => go(-1)} disabled={idx === 0} aria-label="Previous week">←</button>
        <h2>
          Week {idx + 1} of {sched.weeks.length} <span class={`badge phase-${week.phase}`}>{PHASE_LABEL[week.phase]}</span>
        </h2>
        <button class="btn small" type="button" onClick={() => go(1)} disabled={idx === sched.weeks.length - 1} aria-label="Next week">→</button>
      </div>
      <WeekHeader week={week} logged={logged} isCurrent={week.startDate === anchor} />
      <div class="list">
        {week.sessions.map((x) => (
          <SessionCard key={x.id} session={x} entries={entries(x.date)} today={today} onLog={(sess) => setLogging(sess)} onExclude={exclude} />
        ))}
      </div>
      {week.startDate !== anchor && (
        <button class="btn ghost" type="button" onClick={() => (selectedWeekStart.value = null)}>Back to this week</button>
      )}
      {logging && (
        <LogDialog date={logging.date} session={logging} existing={entries(logging.date)[0]} onClose={() => setLogging(null)} />
      )}
    </div>
  );
}

function WeekHeader({ week, logged, isCurrent }: { week: Week; logged: number; isCurrent: boolean }) {
  const end = addDays(week.startDate, 6);
  return (
    <div class="card tight">
      <div class="row between">
        <div>
          <strong>{formatDate(week.startDate)} – {formatDate(end, { year: true })}</strong>
          {week.isStepBack && <span class="muted"> · step-back</span>}
          {week.isRaceWeek && <span class="muted"> · race week</span>}
        </div>
        <div class="muted">
          {km(week.targetKm)} planned{logged > 0 ? ` · ${km(Math.round(logged * 10) / 10)} logged` : ''}
        </div>
      </div>
      {week.notes.length > 0 && (
        <ul class="muted" style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: '0.9rem' }}>
          {week.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      {isCurrent && <span class="sr-only">Current week</span>}
    </div>
  );
}

function TodayCard({ session, entries, onLog }: { session: Session; entries: LogEntry[]; onLog: () => void }) {
  const done = entries.some((e) => !e.skipped && e.distanceKm > 0);
  const skipped = entries.some((e) => e.skipped);
  return (
    <div class="card today-card">
      <div class="row between">
        <div>
          <div class="muted" style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Today</div>
          <h2 style={{ margin: 0 }}>{session.title}</h2>
          {session.distanceKm > 0 && (
            <div class="muted">
              {km(session.distanceKm)}
              {session.pace ? ` · ${paceRange(session.pace)}` : ''}
            </div>
          )}
          <p style={{ margin: '6px 0 0' }}>{session.description}</p>
        </div>
        <div class="actions">
          {done && <span class="status done">✓ Done</span>}
          {skipped && <span class="status skipped">Skipped</span>}
          {!done && session.distanceKm > 0 && (
            <button class="btn primary" type="button" onClick={onLog}>Log today's run</button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Adherence over the last four completed weeks and where the fitness level is heading. */
function PlanHealth() {
  const sched = schedule.value!;
  const recent = sched.fitness.history.slice(-4).filter((w) => w.expectedKm > 0);
  if (recent.length === 0) return null;
  const actual = recent.reduce((a, w) => a + w.km, 0);
  const expected = recent.reduce((a, w) => a + w.expectedKm, 0);
  const adherence = Math.round((actual / expected) * 100);
  const level = sched.fitness.levelKm;
  const start = state.value!.athlete.weeklyKmRecent;
  const trend = level > start * 1.05 ? 'up' : level < start * 0.95 ? 'down' : 'steady';
  const tone = adherence >= 85 ? 'info' : adherence >= 60 ? 'warn' : 'danger';
  const text =
    adherence >= 110
      ? 'You are running more than planned. Fine if it feels easy; the plan ramps with you, never faster than 10 % a week.'
      : adherence >= 85
        ? 'On track. Keep stacking consistent weeks.'
        : adherence >= 60
          ? 'A few sessions slipped. The coming weeks are scaled to what you actually ran, so just pick up where you are.'
          : 'Most of the recent plan was missed. Volume has been reset to a safe level; the ramp starts again from here.';
  return (
    <div class={`alert ${tone}`} role="status">
      <strong>Last {recent.length} week{recent.length > 1 ? 's' : ''}: {adherence} % of planned volume</strong> · fitness level {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {Math.round(level)} km/week. {text}
    </div>
  );
}

function Summary({ daysToRace }: { daysToRace: number }) {
  const s = state.value!;
  const sched = schedule.value!;
  const f = sched.fitness;
  return (
    <div class="card tight">
      <div class="row between">
        <div class="stat">
          <span class="value">{daysToRace}</span>
          <span class="label">days to {s.goal.name ?? 'race day'}</span>
        </div>
        <div class="stat">
          <span class="value">{Math.round(f.levelKm)} km</span>
          <span class="label">current weekly level</span>
        </div>
        {sched.paces && (
          <div class="stat">
            <span class="value">{formatDuration(sched.paces.predictedGoalTimeSec)}</span>
            <span class="label">predicted finish{s.goal.targetTimeSec ? ` (target ${formatDuration(s.goal.targetTimeSec)})` : ''}</span>
          </div>
        )}
      </div>
    </div>
  );
}
