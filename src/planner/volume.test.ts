import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Phase } from '@/domain/types';
import { periodize } from './periodize';
import { computeVolumes, STEP_BACK_FACTOR } from './volume';
import type { WeekVolumeInput } from './volume';

function inputs(phases: Phase[], opts: Record<number, Partial<WeekVolumeInput>> = {}): WeekVolumeInput[] {
  return phases.map((phase, i) => ({ phase, isStepBack: false, blockedDays: 0, raceFactor: 1, ...opts[i] }));
}

describe('computeVolumes', () => {
  it('ramps smoothly from the current level to the peak and never faster than 10 %', () => {
    const vols = computeVolumes(40, 80, inputs(periodize(18).phases));
    for (let i = 1; i < 15; i++) {
      expect(vols[i]!.targetKm / vols[i - 1]!.targetKm).toBeLessThanOrEqual(1.1 + 1e-6);
    }
    expect(vols[14]!.targetKm).toBeCloseTo(80, 0);
  });

  it('holds volume when the athlete already runs the peak volume', () => {
    const vols = computeVolumes(80, 60, inputs(periodize(12).phases));
    expect(vols[0]!.targetKm).toBe(60);
    expect(vols[8]!.targetKm).toBe(60);
  });

  it('reduces step-back weeks and resumes from the pre-step-back level', () => {
    const phases = periodize(12).phases;
    const vols = computeVolumes(50, 70, inputs(phases, { 3: { isStepBack: true } }));
    expect(vols[3]!.targetKm).toBeCloseTo(vols[2]!.targetKm * STEP_BACK_FACTOR, 0);
    expect(vols[4]!.targetKm).toBeGreaterThan(vols[2]!.targetKm);
  });

  it('tapers to well under half the peak in race week', () => {
    const vols = computeVolumes(60, 60, inputs(periodize(16).phases));
    const taper = vols.slice(-3).map((v) => v.targetKm);
    expect(taper[0]).toBeCloseTo(48, 0);
    expect(taper[2]).toBeCloseTo(21, 0);
  });

  it('cuts a blocked week proportionally and re-ramps afterwards', () => {
    const phases = periodize(16).phases;
    const plain = computeVolumes(45, 70, inputs(phases));
    const blocked = computeVolumes(45, 70, inputs(phases, { 4: { blockedDays: 5 } }));
    expect(blocked[4]!.targetKm).toBeCloseTo(plain[4]!.targetKm * (2 / 7), 0);
    expect(blocked[5]!.targetKm).toBeLessThan(plain[5]!.targetKm);
    expect(blocked[5]!.targetKm / blocked[4]!.targetKm).toBeGreaterThan(1);
    // Still reaches the peak by the end of the peak phase.
    expect(blocked[12]!.targetKm).toBeCloseTo(70, 0);
  });

  it('applies the tune-up race factor to that week only', () => {
    const phases = periodize(12).phases;
    const plain = computeVolumes(50, 50, inputs(phases));
    const raced = computeVolumes(50, 50, inputs(phases, { 5: { raceFactor: 0.85 } }));
    expect(raced[5]!.targetKm).toBeCloseTo(plain[5]!.targetKm * 0.85, 0);
    expect(raced[7]!.targetKm).toBeCloseTo(plain[7]!.targetKm, 0);
  });

  it('never exceeds the peak or the ramp limit for any level/peak/length', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 10, max: 120, noNaN: true }),
        fc.double({ min: 10, max: 150, noNaN: true }),
        fc.integer({ min: 1, max: 30 }),
        (level, peak, n) => {
          const vols = computeVolumes(level, peak, inputs(periodize(n).phases));
          expect(vols).toHaveLength(n);
          for (let i = 0; i < n; i++) {
            const v = vols[i]!;
            expect(v.targetKm).toBeLessThanOrEqual(Math.max(peak, Math.min(level, peak)) + 0.1);
            expect(v.targetKm).toBeGreaterThanOrEqual(0);
            if (i > 0 && periodize(n).phases[i] !== 'taper') {
              expect(v.targetKm).toBeLessThanOrEqual(vols[i - 1]!.targetKm * 1.1 + 0.11);
            }
          }
        },
      ),
    );
  });
});
