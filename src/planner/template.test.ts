import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Weekday } from '@/domain/dates';
import type { Phase } from '@/domain/types';
import { paceZones } from './paces';
import { buildWeek, chooseRunDays, distribute, establishedLongRunFloor, fmtKm, longRunFraction, maintainLongRunBoost, marathonLongRunFloor, marathonPaceShare, peakLongRunKm, qualityKinds, structureQuality } from './template';
import type { WeekTemplateInput } from './template';

const ALL: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

function input(partial: Partial<WeekTemplateInput> = {}): WeekTemplateInput {
  return {
    index: 2,
    startDate: '2026-11-09',
    phase: 'build',
    targetKm: 50,
    isStepBack: false,
    isRaceWeek: false,
    daysPerWeek: 5,
    longRunDay: 6,
    availableDays: ALL,
    blockedDates: new Map(),
    longCapKm: 30,
    createdAt: '2026-01-01',
    ...partial,
  };
}

describe('chooseRunDays', () => {
  it('puts the long run on the preferred day and spaces quality sessions out', () => {
    const r = chooseRunDays(6, 5, ALL, 2);
    expect(r.long).toBe(6);
    expect(r.quality).toEqual([2, 4]); // Wed, Fri
    expect(r.easy.sort()).toEqual([1, 3]); // Tue, Thu
  });

  it('moves the long run to the nearest available day', () => {
    const r = chooseRunDays(6, 4, [0, 1, 2, 3, 4, 5], 1);
    expect(r.long).toBe(5);
  });

  it('never schedules more run days than available or requested', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 6 }),
        fc.integer({ min: 1, max: 7 }),
        fc.uniqueArray(fc.integer({ min: 0, max: 6 }), { maxLength: 7 }),
        fc.integer({ min: 0, max: 2 }),
        (long, days, avail, q) => {
          const r = chooseRunDays(long as Weekday, days, avail as Weekday[], q);
          const all = [...(r.long === undefined ? [] : [r.long]), ...r.quality, ...r.easy];
          expect(new Set(all).size).toBe(all.length);
          expect(all.length).toBeLessThanOrEqual(Math.min(days, avail.length));
          for (const d of all) expect(avail).toContain(d);
          expect(r.quality.length).toBeLessThanOrEqual(q);
        },
      ),
    );
  });
});

describe('distribute', () => {
  it('sums to the target with the long run as the longest session', () => {
    const d = distribute(50, 'build', 30, 2, 2);
    const total = d.longKm + d.qualityKm.reduce((a, b) => a + b, 0) + d.easyKm.reduce((a, b) => a + b, 0);
    expect(Math.abs(total - 50)).toBeLessThan(1);
    expect(d.longKm).toBeCloseTo(19.5, 1); // 50 km build week → 0.43 × 0.9 ≈ 39 %
    for (const k of [...d.qualityKm, ...d.easyKm]) expect(k).toBeLessThanOrEqual(d.longKm);
  });

  it('respects the long run cap', () => {
    expect(distribute(100, 'peak', 20, 2, 3).longKm).toBe(20);
  });

  it('drops easy days rather than scheduling junk 2 km runs', () => {
    const d = distribute(20, 'base', 12, 1, 3);
    expect(d.easyKm.length).toBeLessThan(3);
    for (const k of d.easyKm) expect(k).toBeGreaterThanOrEqual(4);
  });

  it('never allocates more than the target (within rounding) for any inputs', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 150, noNaN: true }),
        fc.constantFrom<Phase>('base', 'build', 'maintain', 'peak', 'taper'),
        fc.double({ min: 5, max: 40, noNaN: true }),
        fc.integer({ min: 0, max: 2 }),
        fc.integer({ min: 0, max: 5 }),
        (target, phase, cap, q, e) => {
          const d = distribute(target, phase, cap, q, e);
          const total = d.longKm + d.qualityKm.reduce((a, b) => a + b, 0) + d.easyKm.reduce((a, b) => a + b, 0);
          // Quality sessions have a floor of 5 km, so tiny targets can be exceeded;
          // each session is rounded to 0.5 km, so up to 8 sessions can add 2 km.
          const floor = q * 5;
          expect(total).toBeLessThanOrEqual(Math.max(target, floor) + 2.5);
          expect(d.longKm).toBeLessThanOrEqual(Math.min(cap, 35) + 0.5);
          expect(d.easyKm.length).toBeLessThanOrEqual(e);
        },
      ),
    );
  });
});

describe('qualityKinds and structureQuality', () => {
  it('gives two quality sessions in build/peak only with 5+ days and not on step-back weeks', () => {
    expect(qualityKinds('build', 0, 5, false)).toHaveLength(2);
    expect(qualityKinds('build', 0, 4, false)).toHaveLength(1);
    expect(qualityKinds('build', 0, 6, true)).toHaveLength(1);
    expect(qualityKinds('base', 0, 6, false)).toEqual(['tempo']);
    expect(qualityKinds('taper', 0, 6, false)).toEqual(['tempo']);
    expect(qualityKinds('peak', 1, 5, false)[0]).toBe('tempo');
    expect(qualityKinds('peak', 2, 5, false)[0]).toBe('marathonPace');
  });

  it('builds interval sessions with 3..8 reps and warm-up/cool-down', () => {
    const small = structureQuality('intervals', 6, 'build');
    expect(small.title).toBe('3 × 1 km intervals');
    const big = structureQuality('intervals', 20, 'build');
    expect(big.title).toBe('8 × 1 km intervals');
    expect(big.distanceKm).toBeGreaterThan(12);
    const tempo = structureQuality('tempo', 10, 'build');
    expect(tempo.description).toContain('6.5 km at threshold');
  });
});

describe('buildWeek', () => {
  it('returns seven sessions, Monday first, matching the chosen structure', () => {
    const week = buildWeek(input());
    expect(week).toHaveLength(7);
    expect(week.map((s) => s.date)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
    expect(week.map((s) => s.type)).toEqual(['rest', 'easy', 'tempo', 'easy', 'intervals', 'rest', 'long']);
    const total = week.reduce((a, s) => a + s.distanceKm, 0);
    expect(total).toBeCloseTo(50, 0);
  });

  it('marks blocked days and days before plan creation as rest', () => {
    const week = buildWeek(input({ blockedDates: new Map([['2026-11-11', 'vacation']]), createdAt: '2026-11-10' }));
    expect(week[0]!.title).toBe('Before plan start');
    expect(week[2]!.type).toBe('rest');
    expect(week[2]!.description).toContain('vacation');
    expect(week[2]!.adjusted).toBe(true);
  });

  it('attaches paces when zones are provided', () => {
    const paces = paceZones(45, 42.195);
    const week = buildWeek(input({ paces }));
    const long = week.find((s) => s.type === 'long')!;
    expect(long.pace).toEqual(paces.easy);
    const tempo = week.find((s) => s.type === 'tempo')!;
    expect(tempo.pace).toEqual(paces.threshold);
    expect(week.find((s) => s.type === 'rest')!.pace).toBeUndefined();
  });

  it('adds progressing marathon-pace finishes to peak long runs on alternate weeks', () => {
    const second = buildWeek(input({ phase: 'peak', index: 13, targetKm: 70, phaseOrdinal: 1, phaseLength: 3 })).find((s) => s.type === 'long')!;
    expect(second.description).toContain('marathon pace');
    const first = buildWeek(input({ phase: 'peak', index: 12, targetKm: 70, phaseOrdinal: 0, phaseLength: 3 })).find((s) => s.type === 'long')!;
    expect(first.description).not.toContain('marathon pace');
    const last = buildWeek(input({ phase: 'peak', index: 14, targetKm: 70, phaseOrdinal: 2, phaseLength: 3 })).find((s) => s.type === 'long')!;
    expect(last.description).toContain('marathon pace');
    expect(marathonPaceShare(0, 3)).toBe(0);
    expect(marathonPaceShare(1, 3)).toBeCloseTo(0.3);
    expect(marathonPaceShare(2, 3)).toBeCloseTo(0.4);
    expect(marathonPaceShare(5, 6)).toBeCloseTo(0.5);
    expect(marathonPaceShare(0, 1)).toBeCloseTo(0.3);
  });

  it('runs easy only when asked (return to running)', () => {
    const week = buildWeek(input({ easyOnly: true, targetKm: 40 }));
    expect(week.some((s) => ['tempo', 'intervals', 'marathonPace'].includes(s.type))).toBe(false);
    expect(week.find((s) => s.type === 'long')!.description).toContain('All easy');
    expect(week.filter((s) => s.distanceKm > 0)).toHaveLength(5);
  });

  it('writes titles and descriptions in miles when asked', () => {
    const week = buildWeek(input({ units: 'mi' }));
    expect(week.find((s) => s.type === 'long')!.title).toMatch(/Long run [\d.]+ mi/);
    expect(week.find((s) => s.type === 'tempo')!.description).toContain('mi warm-up');
    expect(fmtKm(1.609344, 'mi')).toBe('1 mi');
    expect(fmtKm(8, 'km')).toBe('8 km');
  });

  it('keeps a short interval session in the first taper week only', () => {
    expect(qualityKinds('taper', 0, 5, false, 0, 3)).toEqual(['intervals']);
    expect(qualityKinds('taper', 1, 5, false, 1, 3)).toEqual(['tempo']);
    expect(qualityKinds('taper', 0, 5, false, 0, 1)).toEqual(['tempo']);
    expect(structureQuality('intervals', 20, 'taper').title).toBe('5 × 1 km intervals');
  });

  it('keeps the long run at the recent longest, within 60 % of the week', () => {
    expect(establishedLongRunFloor(19, 40)).toBe(19);
    expect(establishedLongRunFloor(19, 25)).toBe(15);
    expect(establishedLongRunFloor(0, 40)).toBe(0);
    const d = distribute(40, 'base', 22, 1, 3, 19);
    expect(d.longKm).toBe(19);
    const total = d.longKm + d.qualityKm.reduce((a, b) => a + b, 0) + d.easyKm.reduce((a, b) => a + b, 0);
    expect(Math.abs(total - 40)).toBeLessThan(1.5);
  });

  it('drops quality before shrinking the long run in a tiny week', () => {
    // 17 km budget, 19 km established long run: the long run survives, the tempo goes.
    const d = distribute(17, 'base', 22, 1, 1, 19);
    expect(d.longKm).toBe(19);
    expect(d.qualityKm).toEqual([]);
    expect(d.easyKm).toEqual([]);
    // Without a floor, a tiny week still cannot exceed its budget.
    const tiny = distribute(8, 'base', 22, 1, 1, 0);
    expect(tiny.longKm + tiny.qualityKm.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(8.5);
    const week = buildWeek(input({ targetKm: 17, longCapKm: 22, longFloorKm: 19, daysPerWeek: 4 }));
    expect(week.find((s) => s.type === 'long')!.distanceKm).toBe(19);
    expect(week.filter((s) => s.distanceKm > 0)).toHaveLength(1);
  });

  it('applies the marathon floor in the peak phase, never beyond half the week', () => {
    expect(marathonLongRunFloor(42.195, 'peak', 60, 0)).toBe(28);
    expect(marathonLongRunFloor(42.195, 'peak', 60, 1)).toBe(30);
    expect(marathonLongRunFloor(42.195, 'peak', 60, 2)).toBe(30); // half of 60
    expect(marathonLongRunFloor(42.195, 'peak', 70, 2)).toBe(32);
    expect(marathonLongRunFloor(42.195, 'peak', 40, 2)).toBe(20);
    expect(marathonLongRunFloor(42.195, 'build', 70, 2)).toBe(0);
    expect(marathonLongRunFloor(42.195, 'build', 70, 0, true)).toBe(22);
    expect(marathonLongRunFloor(42.195, 'build', 70, 5, true)).toBe(27);
    expect(marathonLongRunFloor(42.195, 'build', 40, 5, true)).toBe(20);
    expect(maintainLongRunBoost('maintain', 62.5, 2)).toBeGreaterThan(27);
    expect(maintainLongRunBoost('maintain', 62.5, 1)).toBe(0);
    expect(maintainLongRunBoost('build', 62.5, 2)).toBe(0);
    expect(marathonLongRunFloor(21.0975, 'peak', 70, 2)).toBe(0);
    const d = distribute(60, 'peak', 40, 2, 2, 30);
    expect(d.longKm).toBe(30);
    expect(distribute(60, 'peak', 26, 2, 2, 30).longKm).toBe(26); // cap still wins
    expect(peakLongRunKm(60, 42.195)).toBe(30);
    expect(peakLongRunKm(45, 42.195)).toBe(22.5);
    expect(peakLongRunKm(60, 21.0975)).toBe(24.5);
  });

  it('long-run share falls as volume rises', () => {
    expect(longRunFraction('peak', 40)).toBeCloseTo(0.45);
    expect(longRunFraction('peak', 70)).toBeCloseTo(0.39);
    expect(longRunFraction('peak', 100)).toBeCloseTo(0.33);
    expect(longRunFraction('peak', 200)).toBeCloseTo(0.3);
    expect(longRunFraction('base', 60)).toBeLessThan(longRunFraction('peak', 60));
  });

  it('honours availability overrides', () => {
    const week = buildWeek(input({ availableDays: [1, 3, 6], daysPerWeek: 5 }));
    const runDays = week.filter((s) => s.distanceKm > 0).map((s) => s.date);
    expect(runDays).toEqual(['2026-11-10', '2026-11-12', '2026-11-15']);
  });
});
