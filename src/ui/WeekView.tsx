import { signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import { addDays, diffDays, formatDate, startOfWeek } from '@/domain/dates';
import type { Session, Week } from '@/domain/types';
import { formatDuration } from '@/planner/paces';
import { entriesOn, schedule, state, todayDate } from '@/store/state';
import { km, PHASE_LABEL } from './format';
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

  return (
    <div class="stack">
      {week.startDate === anchor && <Warnings warnings={sched.warnings} />}
      <Summary daysToRace={daysToRace} />
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
          <SessionCard key={x.id} session={x} entries={entries(x.date)} today={today} onLog={(sess) => setLogging(sess)} />
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
