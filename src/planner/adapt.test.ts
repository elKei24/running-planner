import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { addDays } from '@/domain/dates';
import type { Session, SessionType } from '@/domain/types';
import { adaptWeek } from './adapt';

const START = '2026-11-09'; // a Monday
const DATES = Array.from({ length: 7 }, (_, i) => addDays(START, i));
const ALL = new Set(DATES);

function week(days: Array<[SessionType, number]>, start = START): Session[] {
  return days.map(([type, km], i) => {
    const date = addDays(start, i);
    return { id: `${date}-${type}`, date, type, distanceKm: km, title: type === 'rest' ? 'Rest' : `${type} ${km} km`, description: 'As planned.', phase: 'build' };
  });
}

/** Settled days from Monday on, with the distance run on each. */
const log = (...km: number[]) => new Map(km.map((k, i) => [DATES[i]!, k]));

// Mon rest · Tue easy · Wed tempo · Thu easy · Fri intervals · Sat rest · Sun long
const base = week([['rest', 0], ['easy', 8], ['tempo', 9], ['easy', 8], ['intervals', 9], ['rest', 0], ['long', 18]]);
// Three runs a week: Wed tempo · Fri easy · Sun long
const threeDay = week([['rest', 0], ['rest', 0], ['tempo', 8], ['rest', 0], ['easy', 6], ['rest', 0], ['long', 16]]);

describe('adaptWeek', () => {
  it('leaves the week untouched while the log matches the plan', () => {
    expect(adaptWeek(base, log(), ALL)).toBe(base);
    expect(adaptWeek(base, log(0, 8, 9, 8), ALL)).toBe(base);
    // A run on a planned run day counts as that session, whatever its distance.
    expect(adaptWeek(base, log(0, 3, 14, 8), ALL)).toBe(base);
  });

  it('drops a missed easy run without touching the rest of the week', () => {
    expect(adaptWeek(base, log(0, 0), ALL)).toBe(base);
  });

  it('lets a run on a rest day replace the next easy run', () => {
    const out = adaptWeek(base, log(8), ALL);
    expect(out[0]).toMatchObject({ date: '2026-11-09', type: 'easy', distanceKm: 8, title: 'Ran 8 km', adjusted: true });
    expect(out[1]).toMatchObject({ type: 'rest', distanceKm: 0, adjusted: true });
    expect(out[1]!.description).toContain('already ran on Mon');
    expect(out.slice(2)).toEqual(base.slice(2));
    // Running on the freed day as well takes the easy run after it.
    const again = adaptWeek(base, log(8, 8), ALL);
    expect(again[1]!.title).toBe('Ran 8 km');
    expect(again[3]).toMatchObject({ type: 'rest', distanceKm: 0 });
    expect(again.filter((s) => s.distanceKm > 0)).toHaveLength(5);
  });

  it('lets a run on a rest day make up for a run missed earlier', () => {
    const shifted = week([['easy', 8], ['rest', 0], ['tempo', 9], ['easy', 8], ['rest', 0], ['rest', 0], ['long', 18]]);
    const out = adaptWeek(shifted, log(0, 8), ALL);
    expect(out[0]).toMatchObject({ type: 'rest', distanceKm: 0, description: 'Done on Tue instead.' });
    expect(out[1]).toMatchObject({ title: 'Ran 8 km', distanceKm: 8 });
    expect(out[1]!.description).toContain('planned on Mon');
    expect(out.slice(2)).toEqual(shifted.slice(2));
  });

  it('counts a long enough run on a rest day as the long run', () => {
    const early = adaptWeek(base, log(0, 8, 9, 8, 9, 15), ALL);
    expect(early[5]).toMatchObject({ title: 'Ran 15 km', description: "Counts as this week's long run." });
    expect(early[6]).toMatchObject({ type: 'rest', distanceKm: 0, description: 'Long run already done on Sat.' });
    // A shorter run does not: the long run stays, and there is no easy run left to replace.
    const short = adaptWeek(base, log(0, 8, 9, 8, 9, 10), ALL);
    expect(short[5]).toMatchObject({ title: 'Ran 10 km', description: 'Extra run on top of the plan.' });
    expect(short[6]).toEqual(base[6]);
  });

  it('swaps the long run with an easy run that was run long enough', () => {
    // Sat easy 6 · Sun long 18
    const plan = week([['rest', 0], ['easy', 8], ['tempo', 9], ['rest', 0], ['easy', 8], ['easy', 6], ['long', 18]]);
    const swapped = adaptWeek(plan, log(0, 8, 9, 0, 8, 15), ALL);
    expect(swapped[5]).toMatchObject({ id: '2026-11-14-long', date: '2026-11-14', type: 'long', distanceKm: 18, adjusted: true });
    expect(swapped[5]!.description).toContain('planned on Sun');
    expect(swapped[6]).toMatchObject({ id: '2026-11-15-easy', date: '2026-11-15', type: 'easy', distanceKm: 6, adjusted: true });
    expect(swapped[6]!.description).toContain('done on Sat');
    expect(swapped.slice(0, 5)).toEqual(plan.slice(0, 5));
    // Running the easy run on Sunday keeps the swap...
    expect(adaptWeek(plan, log(0, 8, 9, 0, 8, 15, 6), ALL)).toEqual(swapped);
    // ...and running long on Sunday after all swaps back: Saturday was the easy run.
    expect(adaptWeek(plan, log(0, 8, 9, 0, 8, 15, 17), ALL)).toBe(plan);
    // A run somewhat over the planned easy distance is still the easy run.
    expect(adaptWeek(plan, log(0, 8, 9, 0, 8, 12), ALL)).toBe(plan);
    // Nor does it apply when the easy run as planned would already pass for the long run.
    const flat = week([['easy', 8], ['rest', 0], ['rest', 0], ['rest', 0], ['rest', 0], ['rest', 0], ['long', 9]]);
    expect(adaptWeek(flat, log(8.5), ALL)).toBe(flat);
  });

  it('swaps back when the long run is run on its own day after a long run on a rest day', () => {
    const out = adaptWeek(base, log(0, 8, 9, 8, 9, 15, 17), ALL);
    expect(out[5]).toMatchObject({ title: 'Ran 15 km', description: 'Extra run on top of the plan.' });
    expect(out[6]).toBe(base[6]);
  });

  it('lets a long enough run on an easy day make up for a missed long run', () => {
    const monLong = week([['long', 18], ['easy', 6], ['rest', 0], ['tempo', 8], ['rest', 0], ['easy', 6], ['rest', 0]]);
    const out = adaptWeek(monLong, log(0, 15), new Set<string>());
    expect(out[0]).toMatchObject({ type: 'rest', distanceKm: 0, description: 'Done on Tue instead.' });
    expect(out[1]).toMatchObject({ date: '2026-11-10', type: 'long', distanceKm: 18 });
    expect(out.slice(2)).toEqual(monLong.slice(2));
  });

  it('moves a missed long run to the next day that fits', () => {
    const wedLong = week([['easy', 6], ['rest', 0], ['long', 18], ['rest', 0], ['easy', 6], ['tempo', 8], ['easy', 6]]);
    const out = adaptWeek(wedLong, log(6, 0, 0), ALL, wedLong);
    expect(out[2]).toMatchObject({ type: 'rest', distanceKm: 0, description: 'Missed. long 18 km moved to Thu.' });
    expect(out[3]).toMatchObject({ id: '2026-11-12-long', date: '2026-11-12', type: 'long', distanceKm: 18, adjusted: true });
    expect(out[3]!.description).toBe('As planned. Moved from Wed.');
    expect(out.slice(4)).toEqual(wedLong.slice(4));
  });

  it('does not move a long run next to another long run', () => {
    const monLong = week([['long', 18], ['easy', 6], ['easy', 6], ['easy', 6], ['easy', 6], ['rest', 0], ['rest', 0]]);
    const weekend = new Set([DATES[5]!, DATES[6]!]);
    const missed = log(0, 6, 6, 6, 6);
    expect(adaptWeek(monLong, missed, weekend, week([['long', 18]], addDays(START, 7)))).toBe(monLong);
    expect(adaptWeek(monLong, missed, weekend)[5]).toMatchObject({ type: 'long', date: '2026-11-14' });
  });

  it('moves a missed quality session only where it keeps two days from other hard sessions', () => {
    // Wed tempo missed: Thu is the day before the intervals, Sat sits between intervals and long run.
    expect(adaptWeek(base, log(0, 8, 0), ALL)).toBe(base);
    // With room, it takes the next free day...
    const free = adaptWeek(threeDay, log(0, 0, 0), ALL);
    expect(free[3]).toMatchObject({ type: 'tempo', date: '2026-11-12', distanceKm: 8 });
    expect(free[4]).toEqual(threeDay[4]);
    // ...or, when that day is not available, the place of an easy run.
    const swap = adaptWeek(threeDay, log(0, 0, 0), new Set(DATES.filter((d) => d !== '2026-11-12')));
    expect(swap[3]).toEqual(threeDay[3]);
    expect(swap[4]).toMatchObject({ type: 'tempo', date: '2026-11-13' });
    expect(swap.filter((s) => s.distanceKm > 0)).toHaveLength(2);
  });

  it('is settled once the adjusted plan is followed, and keeps trying while it is not', () => {
    const moved = adaptWeek(threeDay, log(0, 0, 0), ALL);
    expect(adaptWeek(threeDay, log(0, 0, 0, 8), ALL)).toEqual(moved);
    expect(adaptWeek(threeDay, log(0, 0, 0, 8, 6), ALL)).toEqual(moved);
    // Missed again on Thursday: on to Friday, in place of the easy run.
    const again = adaptWeek(threeDay, log(0, 0, 0, 0), ALL);
    expect(again[3]).toMatchObject({ type: 'rest', description: 'Missed. tempo 8 km moved to Fri.' });
    expect(again[4]).toMatchObject({ type: 'tempo', description: 'As planned. Moved from Thu.' });
    // Saturday is the day before the long run: now it stays missed.
    const dropped = adaptWeek(threeDay, log(0, 0, 0, 0, 0), ALL);
    expect(dropped[4]).toMatchObject({ type: 'tempo' });
    expect(dropped[5]).toEqual(threeDay[5]);
  });

  it('keeps moved sessions away from races', () => {
    const raceWeek = week([['rest', 0], ['tempo', 8], ['rest', 0], ['rest', 0], ['rest', 0], ['rest', 0], ['race', 21.1]]);
    expect(adaptWeek(raceWeek, log(0, 0), ALL)[2]).toMatchObject({ type: 'tempo' }); // four days out is fine
    const late = adaptWeek(raceWeek, log(0, 0, 0), ALL);
    expect(late.slice(3).every((s, i) => s === raceWeek[3 + i])).toBe(true); // three days out is not
    const afterRace = week([['race', 10], ['tempo', 8], ['rest', 0], ['rest', 0], ['rest', 0], ['rest', 0], ['long', 16]]);
    expect(adaptWeek(afterRace, log(10, 0), ALL)).toBe(afterRace);
  });

  it('never moves a session onto a day that is unavailable or shaped by an event', () => {
    const blocked = threeDay.map((s, i) => (i === 3 ? { ...s, description: 'Blocked: vacation.', adjusted: true } : s));
    const out = adaptWeek(blocked, log(0, 0, 0), new Set(DATES.filter((d) => d !== '2026-11-13')));
    expect(out).toBe(blocked);
  });

  it('property: stays within the plan for any week and any log', () => {
    const arbSession = fc.oneof(
      fc.constant<[SessionType, number]>(['rest', 0]),
      fc.tuple(fc.constantFrom<SessionType>('easy', 'recovery', 'long', 'tempo', 'intervals', 'marathonPace', 'race'), fc.integer({ min: 3, max: 30 })),
    );
    fc.assert(
      fc.property(
        fc.array(arbSession, { minLength: 7, maxLength: 7 }),
        fc.array(fc.oneof(fc.constant(0), fc.double({ min: 0.5, max: 30, noNaN: true })), { maxLength: 7 }),
        fc.uniqueArray(fc.integer({ min: 0, max: 6 }), { maxLength: 7 }),
        (days, logged, openDays) => {
          const plan = week(days);
          const open = new Set(openDays.map((d) => DATES[d]!));
          const out = adaptWeek(plan, log(...logged), open, plan);
          expect(out.map((s) => s.date)).toEqual(DATES);
          const key = (s: Session) => ['long', 'tempo', 'intervals', 'marathonPace'].includes(s.type);
          for (const [i, s] of out.entries()) {
            expect(s.id.startsWith(s.date)).toBe(true);
            if (s.type === 'rest') expect(s.distanceKm).toBe(0);
            // Races are never moved, added or removed.
            expect(s.type === 'race').toBe(plan[i]!.type === 'race');
            if (i < logged.length) continue;
            // Days still ahead: a run only appears where one was planned, or on an open day for a missed key session.
            if (s.distanceKm > 0 && plan[i]!.distanceKm === 0) {
              expect(open.has(s.date)).toBe(true);
              expect(key(s)).toBe(true);
            }
          }
          // Nothing is invented: every key session ahead was in the plan.
          const planned = plan.filter(key).length;
          expect(out.filter(key).length).toBeLessThanOrEqual(planned);
          const ahead = (w: Session[]) => w.slice(logged.length).reduce((a, s) => a + s.distanceKm, 0);
          const missedKeyKm = plan.slice(0, logged.length).reduce((a, s, i) => a + (key(s) && logged[i] === 0 ? s.distanceKm : 0), 0);
          expect(ahead(out)).toBeLessThanOrEqual(ahead(plan) + missedKeyKm + 1e-9);
          // Following the plan to the letter is always a no-op.
          expect(adaptWeek(plan, log(...plan.slice(0, logged.length).map((s) => s.distanceKm)), open, plan)).toBe(plan);
        },
      ),
      { numRuns: 300 },
    );
  });
});
