import { signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import { addDays, diffDays, formatDate, startOfWeek } from '@/domain/dates';
import { expectedHr, formatHrRange } from '@/domain/heartRate';
import type { LogEntry, Session, Week } from '@/domain/types';
import { formatDuration } from '@/planner/paces';
import { entriesOn, excludeDay, schedule, state, todayDate } from '@/store/state';
import { km, paceRange, PHASE_LABEL, TYPE_LABEL } from './format';
import { LogDialog } from './LogDialog';
import { SessionCard } from './SessionCard';
import { Warnings } from './Warnings';

/** Week currently shown; null means "the current week". Shared with the plan overview. */
export const selectedWeekStart = signal<string | null>(null);

/** How far back the week view can go. Plans are not kept for past weeks; logged runs are shown. */
export const PAST_WEEKS_LIMIT = 52;

export function pastWeek(startDate: string, index: number): Week {
  return {
    index,
    startDate,
    phase: 'base',
    targetKm: 0,
    isStepBack: false,
    isRaceWeek: false,
    sessions: Array.from({ length: 7 }, (_, i) => {
      const date = addDays(startDate, i);
      return { id: `${date}-past`, date, type: 'rest' as const, distanceKm: 0, phase: 'base' as const, title: 'Past day', description: 'The plan is not kept for past weeks; your logged runs are shown here.' };
    }),
    notes: [],
  };
}

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
  const isPast = start < anchor;
  const weeksBack = isPast ? Math.round(diffDays(start, anchor) / 7) : 0;
  const week = isPast ? pastWeek(start, -weeksBack) : (sched.weeks.find((w) => w.startDate === start) ?? sched.weeks[0]!);
  const idx = week.index;
  const canGoBack = isPast ? weeksBack < PAST_WEEKS_LIMIT : true;
  const go = (delta: number) => {
    const target = addDays(week.startDate, 7 * delta);
    if (target < anchor) {
      if (diffDays(target, anchor) / 7 <= PAST_WEEKS_LIMIT) selectedWeekStart.value = target;
      return;
    }
    const next = sched.weeks.find((w) => w.startDate === target);
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
      {week.startDate === anchor && todaySession && <TodayCard session={todaySession} entries={entries(today)} maxHr={s.athlete.maxHr} onLog={() => setLogging(todaySession)} />}
      {week.startDate === anchor && <PlanHealth />}
      <div class="weeknav">
        <button class="btn icon" type="button" onClick={() => go(-1)} disabled={!canGoBack} aria-label="Previous week">
          <Chevron dir="left" />
        </button>
        <h2>
          {isPast ? (
            <>{weeksBack === 1 ? 'Last week' : `${weeksBack} weeks ago`}</>
          ) : (
            <>
              Week {idx + 1} of {sched.weeks.length} <span class={`badge phase-${week.phase}`}>{PHASE_LABEL[week.phase]}</span>
            </>
          )}
        </h2>
        <button class="btn icon" type="button" onClick={() => go(1)} disabled={!isPast && idx === sched.weeks.length - 1} aria-label="Next week">
          <Chevron dir="right" />
        </button>
      </div>
      <WeekHeader week={week} logged={logged} isCurrent={week.startDate === anchor} />
      <div class="timeline">
        {week.sessions.map((x) => (
          <SessionCard key={x.id} session={x} entries={entries(x.date)} today={today} onLog={(sess) => setLogging(sess)} onExclude={exclude} maxHr={s.athlete.maxHr} />
        ))}
      </div>
      {week.startDate !== anchor && (
        <div class="row">
          <button class="btn" type="button" onClick={() => (selectedWeekStart.value = null)}>Back to this week</button>
        </div>
      )}
      {logging && (
        <LogDialog date={logging.date} session={logging} existing={entries(logging.date)[0]} onClose={() => setLogging(null)} />
      )}
    </div>
  );
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  );
}

function WeekHeader({ week, logged, isCurrent }: { week: Week; logged: number; isCurrent: boolean }) {
  const end = addDays(week.startDate, 6);
  return (
    <div>
      <div class="week-meta">
        <div>
          <strong>{formatDate(week.startDate)} – {formatDate(end, { year: true })}</strong>
          {week.isStepBack && <span class="tags"> · step-back</span>}
          {week.isRaceWeek && <span class="tags"> · race week</span>}
        </div>
        <div class="totals">
          {week.targetKm > 0 ? <><b>{km(week.targetKm)}</b> planned</> : 'Past week'}
          {logged > 0 ? <> · <b>{km(Math.round(logged * 10) / 10)}</b> logged</> : ''}
        </div>
      </div>
      {week.notes.length > 0 && (
        <ul class="week-notes">
          {week.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      {isCurrent && <span class="sr-only">Current week</span>}
    </div>
  );
}

function TodayCard({ session, entries, maxHr, onLog }: { session: Session; entries: LogEntry[]; maxHr?: number; onLog: () => void }) {
  const hr = maxHr ? expectedHr(session.type, maxHr) : undefined;
  const done = entries.some((e) => !e.skipped && e.distanceKm > 0);
  const skipped = entries.some((e) => e.skipped);
  return (
    <div class={`card today-card type-${session.type}`}>
      <div class="today-head">
        <span>Today · {formatDate(session.date, { weekday: true })}</span>
        <span class={`badge type-${session.type}`}>{TYPE_LABEL[session.type]}</span>
      </div>
      <div class="today-body">
        <div>
          <h2>{session.title}</h2>
          {session.distanceKm > 0 && (
            <div class="meta">
              {km(session.distanceKm)}
              {session.pace ? ` · ${paceRange(session.pace)}` : ''}
              {hr ? ` · ${formatHrRange(hr)}` : ''}
            </div>
          )}
          <p>{session.description}</p>
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
    <section class="board" aria-label="Race countdown">
      <div class="headline">
        <span class="display count num">{daysToRace}</span>
        <div class="count-label">
          <strong>{daysToRace === 1 ? 'day' : 'days'} to {s.goal.name ?? 'race day'}</strong>
          <span>
            {formatDate(s.goal.date, { weekday: true, year: true })} · {km(s.goal.distanceKm)}
            {s.goal.targetTimeSec ? ` · target ${formatDuration(s.goal.targetTimeSec)}` : ''}
          </span>
        </div>
      </div>
      <div class="facts">
        <div class="stat">
          <span class="value">{Math.round(f.levelKm)} km</span>
          <span class="label">weekly level</span>
        </div>
        {sched.paces && (
          <div class="stat">
            <span class="value">{formatDuration(sched.paces.predictedGoalTimeSec)}</span>
            <span class="label">predicted finish</span>
          </div>
        )}
      </div>
    </section>
  );
}
