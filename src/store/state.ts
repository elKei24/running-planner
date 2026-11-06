import { computed, effect, signal } from '@preact/signals';
import { startOfWeek, today, weekday } from '@/domain/dates';
import type { LocalDate, Weekday } from '@/domain/dates';
import { SCHEMA_VERSION } from '@/domain/types';
import type { Athlete, Goal, LogEntry, PlanEvent, PlannerState, Schedule, Units } from '@/domain/types';
import { plan } from '@/planner/plan';
import { clearState, loadState, saveState } from './persist';

/** `?today=YYYY-MM-DD` lets you time-travel for demos and manual testing. */
function initialToday(): LocalDate {
  try {
    const param = new URLSearchParams(globalThis.location?.search ?? '').get('today');
    if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) return param;
  } catch {
    // not in a browser
  }
  return today();
}

export const todayDate = signal<LocalDate>(initialToday());
export const state = signal<PlannerState | null>(null);
export const loadError = signal<{ message: string; raw: string } | null>(null);

export const schedule = computed<Schedule | null>(() => (state.value ? plan(state.value, todayDate.value) : null));

export const currentWeek = computed(() => {
  const s = schedule.value;
  if (!s) return null;
  const anchor = startOfWeek(todayDate.value);
  return s.weeks.find((w) => w.startDate === anchor) ?? null;
});

let persistenceEnabled = false;

/** Load from storage and start persisting changes. Call once at startup. */
export function initStore(): void {
  const loaded = loadState();
  state.value = loaded.state;
  loadError.value = loaded.error ?? null;
  if (!persistenceEnabled) {
    persistenceEnabled = true;
    effect(() => {
      if (state.value) saveState(state.value);
    });
  }
}

export function newId(prefix = 'id'): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rand}`;
}

function update(fn: (s: PlannerState) => PlannerState): void {
  const current = state.value;
  if (!current) throw new Error('No plan exists yet');
  state.value = fn(current);
}

export function createPlan(athlete: Athlete, goal: Goal): void {
  state.value = { version: SCHEMA_VERSION, createdAt: todayDate.value, athlete, goal, events: [], log: [], prefs: { units: 'km' } };
  loadError.value = null;
}

export function replaceState(next: PlannerState): void {
  state.value = next;
  loadError.value = null;
}

export function resetPlan(): void {
  state.value = null;
  clearState();
}

export function updateGoal(goal: Goal): void {
  update((s) => ({ ...s, goal }));
}

/** Update athlete settings. Changing the "current fitness" numbers re-baselines the fitness replay to this week. */
export function updateAthlete(athlete: Athlete, rebaseline: boolean): void {
  update((s) => ({ ...s, athlete, ...(rebaseline ? { baselineDate: todayDate.value } : {}) }));
}

/** A PlanEvent without its id, distributed over the union so each kind keeps its own fields. */
export type NewEvent = { [K in PlanEvent['kind']]: Omit<Extract<PlanEvent, { kind: K }>, 'id'> }[PlanEvent['kind']];

export function addEvent(event: NewEvent): string {
  const id = newId(event.kind);
  update((s) => ({ ...s, events: [...s.events, { ...event, id } as PlanEvent] }));
  return id;
}

export function removeEvent(id: string): void {
  update((s) => ({ ...s, events: s.events.filter((e) => e.id !== id) }));
}

export function setUnits(units: Units): void {
  update((s) => ({ ...s, prefs: { ...s.prefs, units } }));
}

const ALL_DAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

/**
 * "I can't run on this day": records an availability override for that week
 * without the given weekday. The planner re-plans the week with the days left.
 */
export function excludeDay(date: LocalDate): void {
  const weekOf = startOfWeek(date);
  const day = weekday(date);
  update((s) => {
    const existing = s.events.find((e) => e.kind === 'availability' && e.weekOf === weekOf);
    const days = (existing && existing.kind === 'availability' ? existing.days : ALL_DAYS).filter((d) => d !== day);
    const others = s.events.filter((e) => e !== existing);
    return { ...s, events: [...others, { id: existing?.id ?? newId('availability'), kind: 'availability', weekOf, days }] };
  });
}

export function logRun(entry: Omit<LogEntry, 'id'> & { id?: string }): string {
  const id = entry.id ?? newId('run');
  update((s) => ({ ...s, log: [...s.log.filter((e) => e.id !== id), { ...entry, id }].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)) }));
  return id;
}

export function removeLog(id: string): void {
  update((s) => ({ ...s, log: s.log.filter((e) => e.id !== id) }));
}

/** Log entries for a date, newest first. */
export function entriesOn(s: PlannerState, date: LocalDate): LogEntry[] {
  return s.log.filter((e) => e.date === date);
}
