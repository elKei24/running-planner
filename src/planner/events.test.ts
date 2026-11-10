import { describe, expect, it } from 'vitest';
import type { Session } from '@/domain/types';
import { applyGoalRace, applyRaces, recoveryDays } from './events';
import type { SessionMap } from './events';
import { paceZones } from './paces';
import { buildWeek } from './template';

function twoWeeks(start = '2026-11-09'): SessionMap {
  const map: SessionMap = new Map();
  for (const [i, s] of [start, '2026-11-16'].entries()) {
    for (const session of buildWeek({
      index: i,
      startDate: s,
      phase: 'build',
      targetKm: 50,
      isStepBack: false,
      isRaceWeek: false,
      daysPerWeek: 6,
      longRunDay: 6,
      availableDays: [0, 1, 2, 3, 4, 5, 6],
      blockedDates: new Map(),
      longCapKm: 30,
      createdAt: '2026-01-01',
    })) {
      map.set(session.date, session);
    }
  }
  return map;
}

const types = (map: SessionMap) => [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1)).map((s) => s.type);

describe('recoveryDays', () => {
  it('scales with distance and caps at two weeks', () => {
    expect(recoveryDays(5)).toBe(2);
    expect(recoveryDays(10)).toBe(4);
    expect(recoveryDays(21.1)).toBe(9);
    expect(recoveryDays(42.195)).toBe(14);
  });
});

describe('applyRaces', () => {
  it('replaces the long run with a B race, eases the days before and recovers after', () => {
    const map = twoWeeks();
    // Week 1: Mon rest, Tue tempo, Wed easy, Thu intervals, Fri easy, Sat easy, Sun long
    applyRaces(map, [{ id: 'r', kind: 'race', date: '2026-11-15', distanceKm: 10, priority: 'B', name: 'City 10k' }], '2026-01-01');
    const t = types(map);
    expect(t.slice(0, 7)).toEqual(['rest', 'tempo', 'easy', 'easy', 'easy', 'easy', 'race']);
    expect(map.get('2026-11-12')!.description).toContain('ahead of the race'); // intervals three days out → easy
    expect(map.get('2026-11-14')!.title).toBe('Shakeout jog');
    expect(map.get('2026-11-14')!.distanceKm).toBeLessThanOrEqual(4);
    expect(map.get('2026-11-15')!.raceEventId).toBe('r');
    expect(map.get('2026-11-15')!.title).toBe('City 10k');
    // Recovery: no quality within 4 days (Tue intervals and Thu tempo become easy).
    expect(map.get('2026-11-16')!.type).toBe('rest');
    for (const date of ['2026-11-17', '2026-11-19']) {
      expect(map.get(date)!.type).toBe('easy');
      expect(map.get(date)!.description).toContain('recovering');
    }
    expect(map.get('2026-11-20')!.adjusted).toBeUndefined(); // day 5: back to normal
  });

  it('keeps a C race as the workout of the day with minimal changes', () => {
    const map = twoWeeks();
    applyRaces(map, [{ id: 'c', kind: 'race', date: '2026-11-11', distanceKm: 5, priority: 'C' }], '2026-01-01');
    expect(map.get('2026-11-11')!.type).toBe('race');
    expect(map.get('2026-11-10')!.type).toBe('easy'); // tempo → easy
    expect(map.get('2026-11-12')!.type).toBe('recovery'); // intervals → recovery jog
    expect(map.get('2026-11-15')!.type).toBe('long');
  });

  it('attaches an equal-effort race pace when zones exist', () => {
    const map = twoWeeks();
    const paces = paceZones(50, 42.195);
    applyRaces(map, [{ id: 'c', kind: 'race', date: '2026-11-12', distanceKm: 5, priority: 'C' }], '2026-01-01', paces);
    const p = map.get('2026-11-12')!.pace!;
    expect(p.minSecPerKm).toBeLessThan(paces.threshold.minSecPerKm);
  });

  it('ignores races after the plan window', () => {
    const map = twoWeeks();
    const before = [...map.values()];
    applyRaces(map, [{ id: 'x', kind: 'race', date: '2027-01-01', distanceKm: 10, priority: 'B' }], '2026-01-01');
    expect([...map.values()]).toEqual(before);
  });

  it('applies recovery for a race that happened before the window (logged late)', () => {
    const map = twoWeeks(); // starts Monday 2026-11-09
    applyRaces(map, [{ id: 'hm', kind: 'race', date: '2026-11-07', distanceKm: 21.0975, priority: 'B' }], '2026-01-01');
    // 9 recovery days: Mon 9 Nov is a rest day, Tue 10 (tempo) and Thu 12 (intervals) become easy, Sun 15 long run stays but easy only.
    for (const date of ['2026-11-10', '2026-11-12']) {
      expect(map.get(date)!.type).toBe('easy');
      expect(map.get(date)!.description).toContain('recovering');
    }
    expect(map.get('2026-11-15')!.description).toContain('recovering');
    expect(map.get('2026-11-17')!.type).toBe('intervals'); // day 10: normal again
    // Even a race before the plan was created still drives recovery, but nothing before `notBefore` is touched.
    const fresh = twoWeeks();
    applyRaces(fresh, [{ id: 'hm', kind: 'race', date: '2026-11-07', distanceKm: 21.0975, priority: 'B' }], '2026-11-09');
    expect(fresh.get('2026-11-10')!.type).toBe('easy');
    expect([...fresh.keys()].every((d) => d >= '2026-11-09')).toBe(true);
  });
});

describe('applyGoalRace', () => {
  it('writes the race, the final-week pattern and post-race recovery', () => {
    const map = twoWeeks();
    applyGoalRace(map, { date: '2026-11-21', distanceKm: 42.195, targetTimeSec: 4 * 3600, name: 'Big One' }, 25, 5, new Set(), '2026-01-01');
    expect(map.get('2026-11-21')!.type).toBe('race');
    expect(map.get('2026-11-21')!.title).toBe('Race day: Big One');
    expect(map.get('2026-11-21')!.pace!.minSecPerKm).toBeCloseTo((4 * 3600) / 42.195 * 0.98, 0);
    expect(map.get('2026-11-20')!.title).toContain('Shakeout');
    expect(map.get('2026-11-19')!.type).toBe('rest');
    expect(map.get('2026-11-17')!.type).toBe('marathonPace');
    expect(map.get('2026-11-22')!.type).toBe('rest');
    expect(map.get('2026-11-22')!.title).toBe('Recovery');
    const preRace = ['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20']
      .map((d) => map.get(d)!.distanceKm)
      .reduce((a, b) => a + b, 0);
    expect(preRace).toBeGreaterThan(20);
    expect(preRace).toBeLessThan(30);
  });

  it('drops the fifth-day-out run for athletes on 4 days or fewer', () => {
    const map = twoWeeks();
    applyGoalRace(map, { date: '2026-11-21', distanceKm: 42.195 }, 25, 4, new Set(), '2026-01-01');
    expect(map.get('2026-11-16')!.type).toBe('rest');
  });

  it('leaves blocked days alone', () => {
    const map = twoWeeks();
    const blockedDay: Session = { ...map.get('2026-11-18')!, type: 'rest', distanceKm: 0, title: 'Rest', description: 'Blocked: illness.' };
    map.set('2026-11-18', blockedDay);
    applyGoalRace(map, { date: '2026-11-21', distanceKm: 42.195 }, 25, 5, new Set(['2026-11-18']), '2026-01-01');
    expect(map.get('2026-11-18')).toBe(blockedDay);
  });
});
