import { beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { App } from './App';
import { addEvent, createPlan, initStore, logRun, removeEvent, removeLog, resetPlan, schedule, state, todayDate, updateAthlete, updateGoal } from '@/store/state';
import { navigate } from './router';
import { memoryStorage } from '@/test/memoryStorage';

const storage = memoryStorage();

const athlete = { weeklyKmRecent: 40, longestRecentRunKm: 16, daysPerWeek: 5, longRunDay: 6 as const, peakWeeklyKm: 75, referenceRace: { distanceKm: 10, timeSec: 2880 } };

async function type(el: Element, value: string) {
  await act(async () => {
    fireEvent.input(el, { target: { value } });
    fireEvent.change(el, { target: { value } });
  });
}

describe('views', () => {
  beforeEach(() => {
    cleanup();
    storage.data.clear();
    todayDate.value = '2026-11-06';
    resetPlan();
    initStore(storage);
    createPlan(athlete, { date: '2027-03-14', distanceKm: 42.195, targetTimeSec: 13500 });
  });

  it('log view lists entries and opens the editor', async () => {
    const id = logRun({ date: '2026-11-04', distanceKm: 9, durationSec: 3000, rpe: 5, note: 'windy' });
    logRun({ date: '2026-11-05', distanceKm: 0, skipped: true });
    navigate('log');
    render(<App />);
    expect(screen.getByText(/2 runs|1 runs/)).toBeTruthy();
    expect(screen.getByText(/windy/)).toBeTruthy();
    expect(screen.getByText('Skipped')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getAllByText('Edit')[0]!);
    });
    const dialog = await waitFor(() => document.querySelector('dialog')!);
    await act(async () => {
      fireEvent.click(dialog.querySelector('button.danger')!);
    });
    // Entries are listed newest first, so the skipped 5 Nov entry was deleted.
    await waitFor(() => expect(state.value!.log).toHaveLength(1));
    expect(state.value!.log[0]!.id).toBe(id);
    removeLog('nope');
    expect(state.value!.log).toHaveLength(1);
    // Add a run for an arbitrary date.
    await act(async () => {
      fireEvent.click(screen.getByText('+ Log a run'));
    });
    const d2 = await waitFor(() => document.querySelector('dialog')!);
    await type(d2.querySelector('input[type=number]')!, '12');
    await act(async () => {
      fireEvent.submit(d2.querySelector('form')!);
    });
    await waitFor(() => expect(state.value!.log).toHaveLength(2));
  });

  it('events view adds and removes races, blocks and availability', async () => {
    navigate('events');
    render(<App />);
    // Race form is the default tab.
    await type(document.querySelector('input[type=date]')!, '2027-01-24');
    await type(document.querySelector('input[type=text]')!, 'Winter Half');
    await act(async () => {
      fireEvent.click(screen.getByText('Add race'));
    });
    await waitFor(() => expect(state.value!.events).toHaveLength(1));
    expect(state.value!.events[0]).toMatchObject({ kind: 'race', date: '2027-01-24', name: 'Winter Half' });

    // Past date is rejected.
    await type(document.querySelector('input[type=date]')!, '2020-01-01');
    await act(async () => {
      fireEvent.click(screen.getByText('Add race'));
    });
    expect(screen.getByText('The race is in the past.')).toBeTruthy();

    // Block form.
    await act(async () => {
      fireEvent.click(screen.getByText('Break / injury'));
    });
    const dates = document.querySelectorAll('input[type=date]');
    await type(dates[0]!, '2026-12-24');
    await type(dates[1]!, '2026-12-28');
    await act(async () => {
      fireEvent.click(screen.getByText('Block these days'));
    });
    await waitFor(() => expect(state.value!.events).toHaveLength(2));
    expect(state.value!.events[1]).toMatchObject({ kind: 'block', from: '2026-12-24', to: '2026-12-28', reason: 'vacation' });

    // Availability form.
    await act(async () => {
      fireEvent.click(screen.getByText('Week availability'));
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Save availability'));
    });
    await waitFor(() => expect(state.value!.events).toHaveLength(3));
    expect(state.value!.events[2]).toMatchObject({ kind: 'availability', weekOf: '2026-11-02', days: [1, 3, 6] });
    // Saving again for the same week replaces it.
    await act(async () => {
      fireEvent.click(screen.getByText('Save availability'));
    });
    await waitFor(() => expect(state.value!.events.filter((e) => e.kind === 'availability')).toHaveLength(1));

    expect(screen.getByText(/Winter Half/)).toBeTruthy();
    expect(screen.getByText(/Vacation/)).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getAllByText('Remove')[0]!);
    });
    await waitFor(() => expect(state.value!.events).toHaveLength(2));
  });

  it('settings view edits goal and athlete and exports', async () => {
    navigate('settings');
    render(<App />);
    expect(screen.getByText('Training paces')).toBeTruthy();
    const forms = document.querySelectorAll('form');
    const goalForm = forms[0]!;
    await type(goalForm.querySelector('input[type=date]')!, '2027-04-11');
    await act(async () => {
      fireEvent.submit(goalForm);
    });
    await waitFor(() => expect(state.value!.goal.date).toBe('2027-04-11'));
    expect(schedule.value!.weeks).toHaveLength(23);

    const athleteForm = document.querySelectorAll('form')[1]!;
    await type(athleteForm.querySelector('input[type=number]')!, '55');
    await act(async () => {
      fireEvent.click(athleteForm.querySelector('input[type=checkbox]')!);
    });
    await act(async () => {
      fireEvent.submit(athleteForm);
    });
    await waitFor(() => expect(state.value!.athlete.weeklyKmRecent).toBe(55));
    expect(state.value!.baselineDate).toBe('2026-11-06');

    // Invalid input shows an error (the form remounts after a save, so re-query it).
    const athleteForm2 = document.querySelectorAll('form')[1]!;
    await type(athleteForm2.querySelectorAll('input[type=text]')[0]!, 'garbage');
    await act(async () => {
      fireEvent.submit(athleteForm2);
    });
    expect(screen.getByText(/Reference race time/)).toBeTruthy();

    // Export buttons do not throw (URL.createObjectURL is stubbed).
    const urls: string[] = [];
    URL.createObjectURL = () => {
      urls.push('blob:x');
      return 'blob:x';
    };
    URL.revokeObjectURL = () => {};
    await act(async () => {
      fireEvent.click(screen.getByText('Export backup (JSON)'));
      fireEvent.click(screen.getByText('Export calendar (.ics)'));
    });
    expect(urls).toHaveLength(2);

    // Reset with confirmation.
    await act(async () => {
      fireEvent.click(screen.getByText('Delete plan and start over'));
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Yes, delete'));
    });
    await waitFor(() => expect(state.value).toBeNull());
    expect(screen.getByText('Plan your marathon')).toBeTruthy();
  });

  it('store actions update and remove', () => {
    updateGoal({ date: '2027-05-02', distanceKm: 42.195 });
    expect(state.value!.goal.date).toBe('2027-05-02');
    updateAthlete({ ...athlete, daysPerWeek: 4 }, false);
    expect(state.value!.athlete.daysPerWeek).toBe(4);
    expect(state.value!.baselineDate).toBeUndefined();
    const id = addEvent({ kind: 'block', from: '2026-12-01', to: '2026-12-02', reason: 'illness' });
    expect(state.value!.events).toHaveLength(1);
    removeEvent(id);
    expect(state.value!.events).toHaveLength(0);
  });

  it('plan overview jumps to a week', async () => {
    navigate('plan');
    render(<App />);
    const rows = document.querySelectorAll('table.weeks tbody tr');
    await act(async () => {
      fireEvent.click(rows[4]!);
    });
    await waitFor(() => expect(screen.getByText('Week 5 of 19')).toBeTruthy());
  });
});
