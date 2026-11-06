import { describe, expect, it } from 'vitest';
import type { PlannerState } from '@/domain/types';
import { plan } from '@/planner/plan';
import { scheduleToIcs } from './ics';
import { exportJson, importJson } from './json';

const state: PlannerState = {
  version: 2,
  createdAt: '2026-11-02',
  athlete: { weeklyKmRecent: 40, longestRecentRunKm: 16, daysPerWeek: 4, longRunDay: 6, peakWeeklyKm: 60 },
  goal: { date: '2027-02-28', distanceKm: 42.195 },
  events: [],
  log: [],
  prefs: { units: 'km' },
};

describe('json', () => {
  it('round-trips and strips export metadata', () => {
    const text = exportJson(state);
    expect(JSON.parse(text).app).toBe('running-planner');
    expect(importJson(text)).toEqual(state);
  });

  it('rejects junk', () => {
    expect(() => importJson('not json')).toThrow(/valid JSON/);
    expect(() => importJson('{"version":1}')).toThrow();
    expect(() => importJson('42')).toThrow();
  });
});

describe('ics', () => {
  it('emits one all-day VEVENT per run, folded to RFC 5545 line lengths', () => {
    const schedule = plan(state, '2026-11-02');
    const ics = scheduleToIcs(schedule);
    const runs = schedule.weeks.flatMap((w) => w.sessions).filter((s) => s.distanceKm > 0 || s.type === 'race').length;
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(runs);
    expect(ics).toContain('DTSTART;VALUE=DATE:20270228');
    expect(ics).toContain('SUMMARY:🏃 Race day');
    for (const line of ics.split('\r\n')) expect(line.length).toBeLessThanOrEqual(75);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('formats distances and paces in miles when asked', () => {
    const schedule = plan({ ...state, athlete: { ...state.athlete, referenceRace: { distanceKm: 10, timeSec: 3000 } } }, '2026-11-02');
    const ics = scheduleToIcs(schedule, 'mi');
    expect(ics).toContain('/mi');
    expect(ics).toContain(' mi');
    expect(ics).not.toContain('/km');
  });
});
