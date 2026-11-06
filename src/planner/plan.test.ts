import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { addDays, startOfWeek, weekday } from '@/domain/dates';
import type { LogEntry, PlannerState, Schedule } from '@/domain/types';
import { plan } from './plan';

function baseState(partial: Partial<PlannerState> = {}): PlannerState {
  return {
    version: 2,
    createdAt: '2026-11-02',
    athlete: {
      weeklyKmRecent: 40,
      longestRecentRunKm: 16,
      daysPerWeek: 5,
      longRunDay: 6,
      peakWeeklyKm: 75,
      referenceRace: { distanceKm: 10, timeSec: 48 * 60 },
    },
    goal: { date: '2027-03-14', distanceKm: 42.195, targetTimeSec: 3 * 3600 + 45 * 60 },
    events: [],
    log: [],
    prefs: { units: 'km' },
    ...partial,
  };
}

const weekKm = (s: Schedule, i: number) => s.weeks[i]!.sessions.reduce((a, x) => a + x.distanceKm, 0);
const longRun = (s: Schedule, i: number) => s.weeks[i]!.sessions.find((x) => x.type === 'long');

describe('plan', () => {
  it('covers every week from the current week to race week, ending with the race', () => {
    const s = plan(baseState(), '2026-11-04');
    expect(s.anchorDate).toBe('2026-11-02');
    expect(s.weeks).toHaveLength(19);
    const last = s.weeks[18]!;
    expect(last.isRaceWeek).toBe(true);
    const race = last.sessions.find((x) => x.type === 'race')!;
    expect(race.date).toBe('2027-03-14');
    expect(race.distanceKm).toBe(42.195);
    expect(race.raceEventId).toBe('goal');
    expect(s.warnings).toEqual([]);
  });

  it('is deterministic', () => {
    const a = plan(baseState(), '2026-11-04');
    const b = plan(baseState(), '2026-11-04');
    expect(a).toEqual(b);
  });

  it('does not change within a week as days pass (stable anchor)', () => {
    const mon = plan(baseState(), '2026-11-09');
    const thu = plan(baseState(), '2026-11-12');
    expect(thu.weeks.map((w) => w.sessions)).toEqual(mon.weeks.map((w) => w.sessions));
  });

  it('marks days before the plan was created as unplanned and pro-rates that week', () => {
    const s = plan(baseState({ createdAt: '2026-11-05' }), '2026-11-06');
    const first = s.weeks[0]!;
    expect(first.sessions.slice(0, 3).every((x) => x.title === 'Before plan start')).toBe(true);
    expect(weekKm(s, 0)).toBeLessThan(weekKm(s, 1));
  });

  it('builds volume towards the peak and tapers, with the long run peaking before the taper', () => {
    const s = plan(baseState(), '2026-11-02');
    const peakIdx = s.weeks.findLastIndex((w) => w.phase === 'peak');
    expect(weekKm(s, peakIdx)).toBeGreaterThan(70);
    expect(longRun(s, peakIdx)!.distanceKm).toBeGreaterThanOrEqual(26);
    expect(weekKm(s, peakIdx + 1)).toBeLessThan(weekKm(s, peakIdx));
    expect(weekKm(s, peakIdx + 2)).toBeLessThan(weekKm(s, peakIdx + 1));
    expect(s.weeks.filter((w) => w.isStepBack).length).toBeGreaterThanOrEqual(3);
  });

  it('adapts after a skipped week: the next week is lower than originally planned', () => {
    const original = plan(baseState(), '2026-11-02');
    const log: LogEntry[] = [];
    // Follow weeks 0 and 1 exactly, skip week 2 entirely.
    for (const w of original.weeks.slice(0, 2)) {
      for (const x of w.sessions) if (x.distanceKm > 0) log.push({ id: x.id, date: x.date, distanceKm: x.distanceKm });
    }
    const after = plan(baseState({ log }), '2026-11-23');
    const originalWeek3 = weekKm(original, 3);
    const adaptedWeek3 = after.weeks[0]!.sessions.reduce((a, x) => a + x.distanceKm, 0);
    expect(adaptedWeek3).toBeLessThan(originalWeek3);
    expect(after.fitness.levelKm).toBeLessThan(original.fitness.levelKm * 1.05);
    expect(after.fitness.source).toBe('log');
    // ...but it still reaches the peak later.
    const peakIdx = after.weeks.findLastIndex((w) => w.phase === 'peak');
    expect(weekKm(after, peakIdx)).toBeGreaterThan(70);
  });

  it('schedules easy-only weeks after a layoff', () => {
    const original = plan(baseState(), '2026-11-02');
    const log: LogEntry[] = [];
    for (const x of original.weeks[0]!.sessions) if (x.distanceKm > 0) log.push({ id: x.id, date: x.date, distanceKm: x.distanceKm });
    const isQuality = (t: string) => ['tempo', 'intervals', 'marathonPace'].includes(t);
    // One week followed, one week skipped → first week easy only.
    const one = plan(baseState({ log }), '2026-11-16');
    expect(one.fitness.layoffWeeks).toBe(1);
    expect(one.weeks[0]!.sessions.some((x) => isQuality(x.type))).toBe(false);
    expect(one.weeks[0]!.notes.join(' ')).toContain('easy running only');
    expect(one.weeks[1]!.sessions.some((x) => isQuality(x.type))).toBe(true);
    // Two weeks skipped → two easy weeks.
    const two = plan(baseState({ log }), '2026-11-23');
    expect(two.fitness.layoffWeeks).toBe(2);
    expect(two.weeks[1]!.sessions.some((x) => isQuality(x.type))).toBe(false);
    expect(two.weeks[2]!.sessions.some((x) => isQuality(x.type))).toBe(true);
  });

  it('uses the units preference in generated titles', () => {
    const s = plan(baseState({ prefs: { units: 'mi' } }), '2026-11-02');
    expect(s.weeks[5]!.sessions.find((x) => x.type === 'long')!.title).toMatch(/mi$/);
    expect(s.weeks[s.weeks.length - 1]!.sessions.find((x) => x.title.startsWith('Shakeout'))!.title).toMatch(/mi$/);
  });

  it('inserts a tune-up race with a mini taper and recovery', () => {
    const s = plan(
      baseState({ events: [{ id: 'hm', kind: 'race', date: '2027-01-24', distanceKm: 21.0975, priority: 'B', name: 'Winter Half' }] }),
      '2026-11-02',
    );
    const week = s.weeks.find((w) => w.startDate === '2027-01-18')!;
    const race = week.sessions.find((x) => x.type === 'race')!;
    expect(race.title).toBe('Winter Half');
    expect(week.sessions.some((x) => x.type === 'long')).toBe(false);
    expect(week.notes.join(' ')).toContain('Tune-up race');
    const next = s.weeks.find((w) => w.startDate === '2027-01-25')!;
    expect(next.sessions.some((x) => x.type === 'tempo' || x.type === 'intervals' || x.type === 'marathonPace')).toBe(false);
  });

  it('removes blocked days and reduces that week', () => {
    const s = plan(baseState({ events: [{ id: 'v', kind: 'block', from: '2026-12-24', to: '2026-12-28', reason: 'vacation' }] }), '2026-11-02');
    const plain = plan(baseState(), '2026-11-02');
    const week = s.weeks.find((w) => w.startDate === '2026-12-21')!;
    const blocked = week.sessions.filter((x) => x.description.includes('vacation'));
    expect(blocked).toHaveLength(4);
    expect(blocked.every((x) => x.distanceKm === 0)).toBe(true);
    expect(weekKm(s, week.index)).toBeLessThan(weekKm(plain, week.index) * 0.7);
  });

  it('honours a custom availability week', () => {
    const s = plan(baseState({ events: [{ id: 'a', kind: 'availability', weekOf: '2026-11-16', days: [0, 2, 5] }] }), '2026-11-02');
    const week = s.weeks[2]!;
    const runDays = week.sessions.filter((x) => x.distanceKm > 0).map((x) => weekday(x.date));
    expect(runDays).toEqual([0, 2, 5]);
    expect(week.notes.join(' ')).toContain('availability');
  });

  it('warns on short, ambitious or low-volume plans', () => {
    const short = plan(baseState({ goal: { date: '2026-12-20', distanceKm: 42.195 } }), '2026-11-02');
    expect(short.warnings.some((w) => w.level === 'danger')).toBe(true);
    const ambitious = plan(baseState({ goal: { date: '2027-03-14', distanceKm: 42.195, targetTimeSec: 3 * 3600 } }), '2026-11-02');
    expect(ambitious.warnings.some((w) => w.message.includes('ambitious'))).toBe(true);
    const lowVolume = plan(baseState({ athlete: { ...baseState().athlete, weeklyKmRecent: 10, longestRecentRunKm: 5 } }), '2026-11-02');
    expect(lowVolume.warnings.some((w) => w.message.includes('km/week'))).toBe(true);
  });

  it('returns no weeks when the race is in the past', () => {
    const s = plan(baseState(), '2027-03-20');
    expect(s.weeks).toEqual([]);
    expect(s.warnings[0]!.message).toContain('past');
  });

  it('works without any pace reference (effort-based sessions)', () => {
    const st = baseState();
    delete st.athlete.referenceRace;
    delete st.goal.targetTimeSec;
    const s = plan(st, '2026-11-02');
    expect(s.paces).toBeUndefined();
    expect(s.weeks[5]!.sessions.every((x) => x.pace === undefined)).toBe(true);
  });

  it('property: every schedule is well-formed for random athletes, dates and events', () => {
    const arbDay = fc.integer({ min: 0, max: 6 });
    fc.assert(
      fc.property(
        fc.record({
          weeklyKmRecent: fc.double({ min: 0, max: 120, noNaN: true }),
          longestRecentRunKm: fc.double({ min: 0, max: 35, noNaN: true }),
          daysPerWeek: fc.integer({ min: 3, max: 7 }),
          longRunDay: arbDay,
          peakWeeklyKm: fc.double({ min: 20, max: 140, noNaN: true }),
        }),
        fc.integer({ min: 1, max: 200 }), // days until race
        fc.integer({ min: 0, max: 6 }), // today offset within the week
        fc.array(
          fc.record({
            offset: fc.integer({ min: 0, max: 200 }),
            km: fc.constantFrom(5, 10, 21.0975, 42.195),
            priority: fc.constantFrom('B', 'C'),
          }),
          { maxLength: 3 },
        ),
        fc.array(fc.record({ offset: fc.integer({ min: 0, max: 200 }), length: fc.integer({ min: 0, max: 14 }) }), { maxLength: 2 }),
        (athlete, daysToRace, todayOffset, races, blocks) => {
          const createdAt = addDays('2026-11-02', todayOffset);
          const state = baseState({
            createdAt,
            athlete: { ...athlete, longRunDay: athlete.longRunDay as 0 | 1 | 2 | 3 | 4 | 5 | 6 },
            goal: { date: addDays(createdAt, daysToRace), distanceKm: 42.195 },
            events: [
              ...races.map((r, i) => ({ id: `r${i}`, kind: 'race' as const, date: addDays(createdAt, r.offset), distanceKm: r.km, priority: r.priority as 'B' | 'C' })),
              ...blocks.map((b, i) => ({ id: `b${i}`, kind: 'block' as const, from: addDays(createdAt, b.offset), to: addDays(createdAt, b.offset + b.length), reason: 'vacation' as const })),
            ],
          });
          const s = plan(state, createdAt);
          expect(s.weeks.length).toBeGreaterThan(0);
          expect(s.weeks[0]!.startDate).toBe(startOfWeek(createdAt));
          for (const [i, w] of s.weeks.entries()) {
            expect(w.sessions).toHaveLength(7);
            expect(w.startDate).toBe(addDays(s.weeks[0]!.startDate, 7 * i));
            for (const [d, x] of w.sessions.entries()) {
              expect(x.date).toBe(addDays(w.startDate, d));
              expect(Number.isFinite(x.distanceKm)).toBe(true);
              expect(x.distanceKm).toBeGreaterThanOrEqual(0);
              expect(x.distanceKm).toBeLessThanOrEqual(42.195);
              if (x.type === 'rest') expect(x.distanceKm).toBe(0);
              if (x.date < createdAt) expect(x.distanceKm).toBe(0);
            }
            const runs = w.sessions.filter((x) => x.distanceKm > 0 && x.type !== 'race').length;
            // The fixed pre-race pattern may add one short shakeout to the week before a mid-week race.
            const slack = i >= s.weeks.length - 2 ? 1 : 0;
            expect(runs).toBeLessThanOrEqual(athlete.daysPerWeek + slack);
          }
          const last = s.weeks[s.weeks.length - 1]!;
          expect(last.sessions.some((x) => x.raceEventId === 'goal')).toBe(true);
          expect(last.sessions.filter((x) => x.date > state.goal.date).every((x) => x.distanceKm === 0)).toBe(true);
        },
      ),
      { numRuns: 150 },
    );
  });
});
