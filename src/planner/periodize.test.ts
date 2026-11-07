import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { periodize, phasePosition, taperFractions } from './periodize';

describe('periodize', () => {
  it('returns an empty plan for zero weeks', () => {
    expect(periodize(0).phases).toEqual([]);
  });

  it('allocates 3 taper + 3 peak weeks for a classic 18-week plan', () => {
    const p = periodize(18);
    expect(p).toMatchObject({ taperWeeks: 3, peakWeeks: 3, buildWeeks: 6, baseWeeks: 6 });
    expect(p.phases.slice(-3)).toEqual(['taper', 'taper', 'taper']);
    expect(p.phases.slice(0, 6)).toEqual(Array(6).fill('base'));
  });

  it('compresses short plans but always keeps a taper week', () => {
    expect(periodize(6)).toMatchObject({ taperWeeks: 1, peakWeeks: 1, buildWeeks: 4, baseWeeks: 0 });
    expect(periodize(1)).toMatchObject({ taperWeeks: 1, peakWeeks: 0, buildWeeks: 0, baseWeeks: 0 });
  });

  it('always produces exactly n phases, ordered base → build → peak → taper', () => {
    const order: Record<string, number> = { base: 0, build: 1, maintain: 2, peak: 3, taper: 4 };
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 60 }), (n) => {
        const { phases } = periodize(n);
        expect(phases).toHaveLength(n);
        expect(phases[phases.length - 1]).toBe('taper');
        for (let i = 1; i < phases.length; i++) {
          expect(order[phases[i]!]!).toBeGreaterThanOrEqual(order[phases[i - 1]!]!);
        }
      }),
    );
  });

  it('fast strategy: initial block, maintain, then a 12-week marathon block', () => {
    const p = periodize(57, 'fast');
    expect(p).toMatchObject({ baseWeeks: 6, buildWeeks: 16, maintainWeeks: 29, peakWeeks: 3, taperWeeks: 3 });
    expect(p.phases.slice(0, 6)).toEqual(Array(6).fill('base'));
    expect(p.phases.slice(6, 16)).toEqual(Array(10).fill('build'));
    expect(p.phases.slice(16, 45)).toEqual(Array(29).fill('maintain'));
    expect(p.phases.slice(45)).toEqual([...Array(6).fill('build'), ...Array(3).fill('peak'), ...Array(3).fill('taper')]);
    // Just above the threshold: a shorter initial block, no maintain.
    expect(periodize(25, 'fast')).toMatchObject({ baseWeeks: 5, maintainWeeks: 0 });
    expect(periodize(25, 'fast').phases).toHaveLength(25);
    // At or below 24 weeks it is the steady plan.
    expect(periodize(24, 'fast')).toEqual(periodize(24, 'steady'));
    expect(periodize(16, 'fast')).toEqual(periodize(16));
  });

  it('phasePosition handles a phase that occurs twice', () => {
    const { phases } = periodize(57, 'fast');
    expect(phasePosition(phases, 6)).toEqual({ ordinal: 0, length: 10 });
    expect(phasePosition(phases, 45)).toEqual({ ordinal: 0, length: 6 });
    expect(phasePosition(phases, 50)).toEqual({ ordinal: 5, length: 6 });
    expect(phasePosition(phases, 53)).toEqual({ ordinal: 2, length: 3 });
  });

  it('taper fractions decrease towards race week', () => {
    for (const n of [1, 2, 3]) {
      const f = taperFractions(n);
      expect(f).toHaveLength(n);
      for (let i = 1; i < f.length; i++) expect(f[i]!).toBeLessThan(f[i - 1]!);
      expect(f[f.length - 1]!).toBeLessThanOrEqual(0.5);
    }
  });
});
