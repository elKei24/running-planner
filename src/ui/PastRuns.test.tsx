import { beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { App } from './App';
import { createPlan, initStore, logRun, resetPlan, state, todayDate } from '@/store/state';
import { navigate } from './router';
import { memoryStorage } from '@/test/memoryStorage';
import { selectedWeekStart } from './WeekView';

const storage = memoryStorage();
const athlete = { weeklyKmRecent: 40, longestRecentRunKm: 16, daysPerWeek: 5, longRunDay: 6 as const, peakWeeklyKm: 75 };

async function type(el: Element, value: string) {
  await act(async () => {
    fireEvent.input(el, { target: { value } });
    fireEvent.change(el, { target: { value } });
  });
}

describe('logging past runs', () => {
  beforeEach(() => {
    cleanup();
    storage.data.clear();
    todayDate.value = '2026-11-20';
    resetPlan();
    initStore(storage);
    createPlan(athlete, { date: '2027-03-14', distanceKm: 42.195 });
    selectedWeekStart.value = null;
    navigate('week');
  });

  it('lets the log dialog pick any past date', async () => {
    navigate('log');
    render(<App />);
    await act(async () => {
      fireEvent.click(screen.getByText('+ Log a run'));
    });
    const dialog = await waitFor(() => document.querySelector('dialog')!);
    await type(dialog.querySelector('input[aria-label="Run date"]')!, '2026-11-12');
    await type(dialog.querySelector('input[type=number]')!, '11');
    await act(async () => {
      fireEvent.submit(dialog.querySelector('form')!);
    });
    await waitFor(() => expect(state.value!.log).toHaveLength(1));
    expect(state.value!.log[0]).toMatchObject({ date: '2026-11-12', distanceKm: 11 });
    // Future dates are refused.
    await act(async () => {
      fireEvent.click(screen.getByText('+ Log a run'));
    });
    const d2 = await waitFor(() => document.querySelector('dialog')!);
    await type(d2.querySelector('input[aria-label="Run date"]')!, '2026-11-21');
    await type(d2.querySelector('input[type=number]')!, '5');
    await act(async () => {
      fireEvent.submit(d2.querySelector('form')!);
    });
    expect(screen.getByText(/cannot log a run in the future/)).toBeTruthy();
    expect(state.value!.log).toHaveLength(1);
  });

  it('navigates back into past weeks and logs from a day card there', async () => {
    logRun({ date: '2026-11-10', distanceKm: 8 });
    render(<App />);
    expect(screen.getByText(/Week 1 of/)).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Previous week'));
    });
    await waitFor(() => expect(screen.getByText('Last week')).toBeTruthy());
    expect(screen.getByText(/Logged 8 km/)).toBeTruthy();
    expect(document.querySelectorAll('article.session')).toHaveLength(7);
    const logButtons = screen.getAllByRole('button', { name: 'Log' });
    expect(logButtons.length).toBe(6); // every day except the logged one, which says Edit
    await act(async () => {
      fireEvent.click(logButtons[0]!);
    });
    const dialog = await waitFor(() => document.querySelector('dialog')!);
    expect(dialog.textContent).toContain('2026-11-09');
    await type(dialog.querySelector('input[type=number]')!, '6');
    await act(async () => {
      fireEvent.submit(dialog.querySelector('form')!);
    });
    await waitFor(() => expect(state.value!.log).toHaveLength(2));
    expect(state.value!.log.find((e) => e.date === '2026-11-09')!.distanceKm).toBe(6);
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Previous week'));
    });
    await waitFor(() => expect(screen.getByText('2 weeks ago')).toBeTruthy());
    await act(async () => {
      fireEvent.click(screen.getByText('Back to this week'));
    });
    await waitFor(() => expect(screen.getByText(/Week 1 of/)).toBeTruthy());
  });
});
