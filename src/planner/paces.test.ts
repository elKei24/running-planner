import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  formatDuration,
  formatPace,
  formatPaceRange,
  paceZones,
  parseDuration,
  predictTime,
  racePace,
  vdotFromRace,
} from './paces';

describe('VDOT model', () => {
  it('matches Daniels tables for well-known performances', () => {
    // 5k in 20:00 → VDOT ≈ 49.8; 10k in 40:00 → ≈ 51.4; marathon 3:00 → ≈ 53.5
    expect(Math.abs(vdotFromRace(5, 20 * 60) - 49.8)).toBeLessThan(1);
    expect(Math.abs(vdotFromRace(10, 40 * 60) - 51.4)).toBeLessThan(1);
    expect(Math.abs(vdotFromRace(42.195, 3 * 3600) - 53.5)).toBeLessThan(1);
  });

  it('predicts equivalent performances (10k 40:00 → marathon ≈ 3:05)', () => {
    const vdot = vdotFromRace(10, 40 * 60);
    const marathon = predictTime(vdot, 42.195);
    expect(marathon / 60).toBeGreaterThan(182);
    expect(marathon / 60).toBeLessThan(188);
  });

  it('round-trips: predicting the reference distance returns the reference time', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 3, max: 42.195, noNaN: true }),
        fc.double({ min: 200, max: 480, noNaN: true }), // sec/km
        (km, pace) => {
          const t = km * pace;
          const vdot = vdotFromRace(km, t);
          expect(predictTime(vdot, km)).toBeCloseTo(t, 0);
        },
      ),
    );
  });

  it('orders zones from easy (slowest) to interval (fastest)', () => {
    const z = paceZones(vdotFromRace(10, 45 * 60), 42.195);
    expect(z.easy.maxSecPerKm).toBeGreaterThan(z.easy.minSecPerKm);
    expect(z.easy.minSecPerKm).toBeGreaterThan(z.marathon.maxSecPerKm);
    expect(z.marathon.minSecPerKm).toBeGreaterThan(z.threshold.minSecPerKm);
    expect(z.threshold.minSecPerKm).toBeGreaterThan(z.interval.minSecPerKm);
    expect(z.predictedGoalTimeSec).toBeGreaterThan(3 * 3600);
  });

  it('race pace gets slower with distance', () => {
    const vdot = 45;
    expect(racePace(vdot, 5).minSecPerKm).toBeLessThan(racePace(vdot, 10).minSecPerKm);
    expect(racePace(vdot, 10).minSecPerKm).toBeLessThan(racePace(vdot, 21.0975).minSecPerKm);
  });

  it('formats and parses times', () => {
    expect(formatPace(305)).toBe('5:05');
    expect(formatPaceRange({ minSecPerKm: 300, maxSecPerKm: 330 })).toBe('5:00–5:30 /km');
    expect(formatDuration(3 * 3600 + 5 * 60 + 9)).toBe('3:05:09');
    expect(formatDuration(45 * 60)).toBe('45:00');
    expect(parseDuration('3:05:09')).toBe(3 * 3600 + 5 * 60 + 9);
    expect(parseDuration('45:30')).toBe(45 * 60 + 30);
    expect(parseDuration('nope')).toBeUndefined();
    expect(parseDuration('1:2:3:4')).toBeUndefined();
  });
});
