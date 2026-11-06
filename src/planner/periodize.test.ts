import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { periodize, taperFractions } from './periodize';

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
    const order = { base: 0, build: 1, peak: 2, taper: 3 };
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 60 }), (n) => {
        const { phases } = periodize(n);
        expect(phases).toHaveLength(n);
        expect(phases[phases.length - 1]).toBe('taper');
        for (let i = 1; i < phases.length; i++) {
          expect(order[phases[i]!]).toBeGreaterThanOrEqual(order[phases[i - 1]!]);
        }
      }),
    );
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
