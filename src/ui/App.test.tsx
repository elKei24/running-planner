import { beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { App } from './App';
import { addEvent, createPlan, initStore, logRun, replaceState, resetPlan, schedule, state, todayDate, updateAthlete } from '@/store/state';
import { STORAGE_KEY } from '@/store/persist';
import { memoryStorage } from '@/test/memoryStorage';

const storage = memoryStorage();
import { navigate } from './router';

const athlete = { weeklyKmRecent: 40, longestRecentRunKm: 16, daysPerWeek: 5, longRunDay: 6 as const, peakWeeklyKm: 75, referenceRace: { distanceKm: 10, timeSec: 2880 } };

describe('App', () => {
  beforeEach(() => {
    cleanup();
    storage.data.clear();
    todayDate.value = '2026-11-06';
    resetPlan();
    initStore(storage);
    navigate('week');
  });

  it('shows the setup form when there is no plan and creates one', async () => {
    render(<App />);
    expect(screen.getByText('Plan your race')).toBeTruthy();
    const date = document.querySelector<HTMLInputElement>('input[type=date]')!;
    await act(async () => {
      fireEvent.input(date, { target: { value: '2027-03-14' } });
    });
    await act(async () => {
      fireEvent.submit(document.querySelector('form')!);
    });
    await waitFor(() => expect(state.value).not.toBeNull());
    expect(state.value!.goal.date).toBe('2027-03-14');
    expect(state.value!.createdAt).toBe('2026-11-06');
    expect(screen.getByText(/Week 1 of/)).toBeTruthy();
    // Persisted.
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).goal.date).toBe('2027-03-14');
  });

  it('renders the current week with sessions and navigates between weeks', async () => {
    createPlan(athlete, { date: '2027-03-14', distanceKm: 42.195 });
    render(<App />);
    expect(screen.getByText('Week 1 of 19')).toBeTruthy();
    expect(document.querySelectorAll('article.session')).toHaveLength(7);
    fireEvent.click(screen.getByLabelText('Next week'));
    await waitFor(() => expect(screen.getByText('Week 2 of 19')).toBeTruthy());
    fireEvent.click(screen.getByText('Back to this week'));
    await waitFor(() => expect(screen.getByText('Week 1 of 19')).toBeTruthy());
  });

  it('shows a heart-rate band on planned runs once a max heart rate is set', async () => {
    createPlan(athlete, { date: '2027-03-14', distanceKm: 42.195 });
    render(<App />);
    expect(document.body.textContent).not.toContain('bpm');
    updateAthlete({ ...state.value!.athlete, maxHr: 190 }, false);
    // Easy runs sit at 65–79 % of max; the first week of a fresh plan is easy running only.
    await waitFor(() => expect(screen.getAllByText(/124–150 bpm/).length).toBeGreaterThan(0));
  });

  it('logs a run from a session card and reflects it', async () => {
    createPlan(athlete, { date: '2027-03-14', distanceKm: 42.195 });
    // Plan created on Friday; it is now Sunday, the long-run day, so that card has a Log button.
    todayDate.value = '2026-11-08';
    render(<App />);
    const buttons = screen.getAllByRole('button', { name: 'Log' });
    await act(async () => {
      fireEvent.click(buttons[buttons.length - 1]!);
    });
    const dialog = await waitFor(() => document.querySelector('dialog')!);
    // RPE guidance: the options explain each level and the planned type sets an expected range.
    expect(dialog.textContent).toContain('should feel like');
    expect([...dialog.querySelectorAll('option')].map((o) => o.textContent)).toContain('7 · Very hard');
    expect(dialog.querySelector('#rpe-meaning')!.textContent).toContain('conversational');
    await act(async () => {
      fireEvent.change(dialog.querySelector('select')!, { target: { value: '8' } });
    });
    expect(dialog.querySelector('#rpe-meaning')!.textContent).toContain('Interval effort');
    const distance = dialog.querySelector<HTMLInputElement>('input[type=number]')!;
    await act(async () => {
      fireEvent.input(distance, { target: { value: '7.5' } });
    });
    // Duration is typed as plain digits and formats itself stopwatch style.
    const duration = dialog.querySelector<HTMLInputElement>('input[placeholder="hh:mm:ss"]')!;
    await act(async () => {
      fireEvent.input(duration, { target: { value: '4530' } });
    });
    expect(duration.value).toBe('00:45:30');
    await act(async () => {
      fireEvent.submit(dialog.querySelector('form')!);
    });
    await waitFor(() => expect(state.value!.log).toHaveLength(1));
    expect(state.value!.log[0]!.distanceKm).toBe(7.5);
    expect(state.value!.log[0]!.durationSec).toBe(45 * 60 + 30);
    expect(screen.getByText(/Logged 7.5 km/)).toBeTruthy();
  });

  it('shows events and the plan overview', async () => {
    createPlan(athlete, { date: '2027-03-14', distanceKm: 42.195 });
    addEvent({ kind: 'race', date: '2027-01-24', distanceKm: 21.0975, priority: 'B', name: 'Winter Half' });
    navigate('events');
    render(<App />);
    expect(screen.getByText(/Winter Half/)).toBeTruthy();
    navigate('plan');
    await waitFor(() => expect(screen.getByText('All weeks')).toBeTruthy());
    expect(document.querySelectorAll('table.weeks tbody tr')).toHaveLength(19);
  });

  it('recomputes the schedule when the log changes', () => {
    createPlan(athlete, { date: '2027-03-14', distanceKm: 42.195 });
    const before = schedule.value!.fitness.levelKm;
    todayDate.value = '2026-11-16';
    logRun({ date: '2026-11-07', distanceKm: 20 });
    logRun({ date: '2026-11-10', distanceKm: 60 });
    expect(schedule.value!.fitness.levelKm).toBeGreaterThan(before);
  });

  it('warns when the browser refuses to persist', async () => {
    const broken = { ...memoryStorage(), setItem: () => { throw new Error('blocked'); } };
    initStore(broken);
    createPlan(athlete, { date: '2027-03-14', distanceKm: 42.195 });
    render(<App />);
    expect(screen.getByText(/not saving your data/)).toBeTruthy();
    const urls: string[] = [];
    URL.createObjectURL = () => { urls.push('blob:x'); return 'blob:x'; };
    URL.revokeObjectURL = () => {};
    await act(async () => {
      fireEvent.click(screen.getByText('Export backup'));
    });
    expect(urls).toHaveLength(1);
    initStore(storage);
  });

  it('replaces state on import', () => {
    createPlan(athlete, { date: '2027-03-14', distanceKm: 42.195 });
    replaceState({ ...state.value!, goal: { date: '2027-04-11', distanceKm: 42.195 } });
    expect(schedule.value!.weeks.length).toBe(23);
  });
});
