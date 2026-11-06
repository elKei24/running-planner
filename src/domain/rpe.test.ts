import { describe, expect, it } from 'vitest';
import { expectedRpe, RPE_SCALE, rpeLabel } from './rpe';

describe('rpe', () => {
  it('describes all ten levels in order', () => {
    expect(RPE_SCALE.map((r) => r.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const r of RPE_SCALE) {
      expect(r.label.length).toBeGreaterThan(0);
      expect(r.meaning.length).toBeGreaterThan(10);
    }
    expect(rpeLabel(3)).toBe('Easy');
    expect(rpeLabel(42)).toBe('');
  });

  it('expects easy sessions to feel easier than quality sessions', () => {
    expect(expectedRpe('easy')![1]).toBeLessThan(expectedRpe('tempo')![0]);
    expect(expectedRpe('tempo')![1]).toBeLessThan(expectedRpe('intervals')![0]);
    expect(expectedRpe('rest')).toBeUndefined();
  });
});
