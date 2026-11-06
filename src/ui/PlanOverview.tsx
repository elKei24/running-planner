import { addDays, formatDate, startOfWeek } from '@/domain/dates';
import type { Week } from '@/domain/types';
import { schedule, state, todayDate } from '@/store/state';
import { km, PHASE_LABEL } from './format';
import { navigate } from './router';
import { selectedWeekStart } from './WeekView';
import { Warnings } from './Warnings';

export function PlanOverview() {
  const s = state.value!;
  const sched = schedule.value!;
  const anchor = startOfWeek(todayDate.value);
  const weeks = sched.weeks;
  if (weeks.length === 0) {
    return (
      <div class="card">
        <Warnings warnings={sched.warnings} />
      </div>
    );
  }
  const actualByWeek = new Map<string, number>();
  for (const e of s.log) {
    if (e.skipped) continue;
    const w = startOfWeek(e.date);
    actualByWeek.set(w, (actualByWeek.get(w) ?? 0) + e.distanceKm);
  }
  const history = sched.fitness.history;
  const maxKm = Math.max(1, ...weeks.map((w) => w.targetKm), ...history.map((h) => h.km));
  const open = (w: Week) => {
    selectedWeekStart.value = w.startDate;
    navigate('week');
  };

  return (
    <div class="stack">
      <div class="card">
        <h2>Weekly volume</h2>
        <p class="muted">Bars are planned km (lighter = step-back week). The dark line is what you actually logged.</p>
        <div class="bars" role="list">
          {history.slice(-8).map((h) => (
            <div key={h.startDate} class="bar" role="listitem" title={`${formatDate(h.startDate)}: logged ${km(h.km)}`}>
              <div class="fill" style={{ height: `${(h.km / maxKm) * 100}%`, background: 'var(--border)' }} />
            </div>
          ))}
          {weeks.map((w) => {
            const actual = actualByWeek.get(w.startDate);
            return (
              <button
                key={w.startDate}
                type="button"
                class={`bar ${w.isStepBack ? 'stepback' : ''} ${w.startDate === anchor ? 'selected' : ''}`}
                onClick={() => open(w)}
                title={`Week ${w.index + 1} (${PHASE_LABEL[w.phase]}): ${km(w.targetKm)}`}
                aria-label={`Week ${w.index + 1}, ${PHASE_LABEL[w.phase]}, ${km(w.targetKm)}`}
              >
                <div class="fill" style={{ height: `${(w.targetKm / maxKm) * 100}%`, background: `var(--phase-${w.phase})` }} />
                {actual !== undefined && actual > 0 && <div class="actual" style={{ bottom: `${(Math.min(actual, maxKm) / maxKm) * 100}%` }} />}
              </button>
            );
          })}
        </div>
        <div class="legend">
          {(['base', 'build', 'peak', 'taper'] as const).map((p) => (
            <span key={p}>
              <span class="dot" style={{ background: `var(--phase-${p})` }} />
              {PHASE_LABEL[p]}
            </span>
          ))}
          <span>
            <span class="dot" style={{ background: 'var(--border)' }} />
            Past weeks (logged)
          </span>
        </div>
      </div>
      <div class="card">
        <h2>All weeks</h2>
        <table class="weeks">
          <thead>
            <tr>
              <th>#</th>
              <th>Week of</th>
              <th>Phase</th>
              <th>Km</th>
              <th>Long run</th>
              <th>Key sessions</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => {
              const long = w.sessions.find((x) => x.type === 'long');
              const keys = w.sessions.filter((x) => ['tempo', 'intervals', 'marathonPace', 'race'].includes(x.type)).map((x) => x.title);
              return (
                <tr key={w.startDate} class={w.startDate === anchor ? 'current' : ''} onClick={() => open(w)}>
                  <td>{w.index + 1}</td>
                  <td>{formatDate(w.startDate)}{w.isRaceWeek ? ' 🏁' : ''}</td>
                  <td><span class={`badge phase-${w.phase}`}>{PHASE_LABEL[w.phase]}</span>{w.isStepBack ? ' ↓' : ''}</td>
                  <td>{km(w.targetKm)}</td>
                  <td>{long ? km(long.distanceKm) : '–'}</td>
                  <td class="muted">{keys.join(', ') || '–'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p class="muted" style={{ marginTop: 8 }}>
          Race day {formatDate(s.goal.date, { weekday: true, year: true })}. The plan ends {formatDate(addDays(s.goal.date, 1))}.
        </p>
      </div>
    </div>
  );
}
