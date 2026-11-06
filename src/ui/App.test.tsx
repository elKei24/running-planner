import { beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { App } from './App';
import { addEvent, createPlan, initStore, logRun, replaceState, resetPlan, schedule, state, todayDate } from '@/store/state';
import { STORAGE_KEY } from '@/store/persist';
import { navigate } from './router';

const athlete = { weeklyKmRecent: 40, longestRecentRunKm: 16, daysPerWeek: 5, longRunDay: 6 as const, peakWeeklyKm: 75, referenceRace: { distanceKm: 10, timeSec: 2880 } };

describe('App', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    todayDate.value = '2026-11-06';
    resetPlan();
    initStore();
    navigate('week');
  });

  it('shows the setup form when there is no plan and creates one', async () => {
    render(<App />);
    expect(screen.getByText('Plan your marathon')).toBeTruthy();
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
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).goal.date).toBe('2027-03-14');
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

  it('logs a run from a session card and reflects it', async () => {
    createPlan(athlete, { date: '2027-03-14', distanceKm: 42.195 });
    render(<App />);
    const buttons = screen.getAllByRole('button', { name: 'Log' });
    await act(async () => {
      fireEvent.click(buttons[0]!);
    });
    const dialog = await waitFor(() => document.querySelector('dialog')!);
    const distance = dialog.querySelector<HTMLInputElement>('input[type=number]')!;
    await act(async () => {
      fireEvent.input(distance, { target: { value: '7.5' } });
    });
    await act(async () => {
      fireEvent.submit(dialog.querySelector('form')!);
    });
    await waitFor(() => expect(state.value!.log).toHaveLength(1));
    expect(state.value!.log[0]!.distanceKm).toBe(7.5);
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

  it('replaces state on import', () => {
    createPlan(athlete, { date: '2027-03-14', distanceKm: 42.195 });
    replaceState({ ...state.value!, goal: { date: '2027-04-11', distanceKm: 42.195 } });
    expect(schedule.value!.weeks.length).toBe(23);
  });
});
