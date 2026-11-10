import { describe, expect, it } from 'vitest';
import type { PlannerState } from '@/domain/types';
import { migrate } from './migrations';
import { clearState, loadState, saveState, STORAGE_KEY } from './persist';
import { validateState, ValidationError } from './schema';

const valid: PlannerState = {
  version: 2,
  createdAt: '2026-11-02',
  athlete: { weeklyKmRecent: 40, longestRecentRunKm: 16, daysPerWeek: 5, longRunDay: 6, peakWeeklyKm: 75, referenceRace: { distanceKm: 10, timeSec: 2880 } },
  goal: { date: '2027-03-14', distanceKm: 42.195, targetTimeSec: 13500, name: 'Spring' },
  events: [
    { id: 'r1', kind: 'race', date: '2027-01-24', distanceKm: 21.0975, priority: 'B', name: 'Half' },
    { id: 'b1', kind: 'block', from: '2026-12-24', to: '2026-12-28', reason: 'vacation' },
    { id: 'a1', kind: 'availability', weekOf: '2026-11-16', days: [1, 3, 6] },
  ],
  log: [{ id: 'l1', date: '2026-11-03', distanceKm: 8, durationSec: 2700, rpe: 4, note: 'nice' }],
  prefs: { units: 'km' },
};

describe('validateState', () => {
  it('accepts a valid state and strips nothing', () => {
    expect(validateState(JSON.parse(JSON.stringify(valid)))).toEqual(valid);
  });

  it('rejects malformed input with a helpful path', () => {
    expect(() => validateState(null)).toThrow(ValidationError);
    expect(() => validateState({ ...valid, createdAt: '2026-13-01' })).toThrow(/createdAt/);
    expect(() => validateState({ ...valid, athlete: { ...valid.athlete, daysPerWeek: 9 } })).toThrow(/daysPerWeek/);
    expect(() => validateState({ ...valid, events: [{ id: 'x', kind: 'party' }] })).toThrow(/kind/);
    expect(() => validateState({ ...valid, events: [{ id: 'x', kind: 'block', from: '2026-12-28', to: '2026-12-24', reason: 'vacation' }] })).toThrow(/to/);
    expect(() => validateState({ ...valid, log: [{ id: 'l1', date: '2026-11-03', distanceKm: 8 }, { id: 'l1', date: '2026-11-04', distanceKm: 8 }] })).toThrow(/unique/);
    expect(() => validateState({ ...valid, version: 99 })).toThrow(/version/);
    expect(() => validateState({ ...valid, prefs: { units: 'furlongs' } })).toThrow(/units/);
    expect(() => validateState({ ...valid, athlete: { ...valid.athlete, buildStrategy: 'yolo' } })).toThrow(/buildStrategy/);
    expect(validateState({ ...valid, athlete: { ...valid.athlete, buildStrategy: 'fast' } }).athlete.buildStrategy).toBe('fast');
    expect(() => validateState({ ...valid, athlete: { ...valid.athlete, maxHr: 20 } })).toThrow(/maxHr/);
    expect(validateState({ ...valid, athlete: { ...valid.athlete, maxHr: 188.4 } }).athlete.maxHr).toBe(188);
    expect(validateState({ ...valid, athlete: { ...valid.athlete, maxHr: null } }).athlete.maxHr).toBeUndefined();
  });

  it('normalises availability days (dedupe + sort) and optional fields', () => {
    const s = validateState({ ...valid, events: [{ id: 'a', kind: 'availability', weekOf: '2026-11-16', days: [6, 1, 6] }], log: [{ id: 'l', date: '2026-11-03', distanceKm: 5, note: '', rpe: null }] });
    expect(s.events[0]).toEqual({ id: 'a', kind: 'availability', weekOf: '2026-11-16', days: [1, 6] });
    const replanned = validateState({ ...valid, events: [{ id: 'a', kind: 'availability', weekOf: '2026-11-16', days: [1, 6], replanFrom: '2026-11-18' }] });
    expect(replanned.events[0]).toEqual({ id: 'a', kind: 'availability', weekOf: '2026-11-16', days: [1, 6], replanFrom: '2026-11-18' });
    expect(() => validateState({ ...valid, events: [{ id: 'a', kind: 'availability', weekOf: '2026-11-16', days: [1], replanFrom: 'yesterday' }] })).toThrow(/replanFrom/);
    expect(s.log[0]).toEqual({ id: 'l', date: '2026-11-03', distanceKm: 5 });
  });
});

describe('migrate', () => {
  it('passes a current document through', () => {
    expect(migrate(valid)).toEqual(valid);
  });

  it('refuses documents from the future', () => {
    expect(() => migrate({ ...valid, version: 42 })).toThrow(/newer version/);
  });

  it('migrates a version 1 document (no prefs) to the current schema', () => {
    const { prefs: _p, ...v1 } = { ...valid, version: 1 };
    const migrated = migrate(v1);
    expect(migrated.version).toBe(2);
    expect(migrated.prefs).toEqual({ units: 'km' });
    expect(migrated.goal).toEqual(valid.goal);
  });

  it('treats a missing version as 1', () => {
    const { version: _v, prefs: _p, ...noVersion } = valid;
    expect(migrate(noVersion).version).toBe(2);
  });
});

describe('persist', () => {
  function memoryStorage(initial: Record<string, string> = {}) {
    const data = new Map(Object.entries(initial));
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
      data,
    };
  }

  it('round-trips through storage', () => {
    const storage = memoryStorage();
    expect(saveState(valid, storage)).toBe(true);
    expect(loadState(storage)).toEqual({ state: valid });
    clearState(storage);
    expect(loadState(storage)).toEqual({ state: null });
  });

  it('returns an error (and keeps the raw text) for corrupted data', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: '{"version":1,"athlete":' });
    const result = loadState(storage);
    expect(result.state).toBeNull();
    expect(result.error?.raw).toBe('{"version":1,"athlete":');
  });

  it('survives a missing storage', () => {
    expect(loadState(null)).toEqual({ state: null });
    expect(saveState(valid, null)).toBe(false);
  });
});
