import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  addDays,
  dateRange,
  diffDays,
  formatDate,
  isLocalDate,
  startOfWeek,
  today,
  weekday,
  weeksBetween,
} from './dates';

const arbDate = fc
  .date({ min: new Date('1990-01-01T00:00:00Z'), max: new Date('2100-12-31T00:00:00Z'), noInvalidDate: true })
  .map((d) => d.toISOString().slice(0, 10));

describe('dates', () => {
  it('validates ISO local dates', () => {
    expect(isLocalDate('2026-11-06')).toBe(true);
    expect(isLocalDate('2026-02-30')).toBe(false);
    expect(isLocalDate('2026-13-01')).toBe(false);
    expect(isLocalDate('06/11/2026')).toBe(false);
    expect(isLocalDate(20261106)).toBe(false);
  });

  it('adds and diffs days across month and year boundaries', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(diffDays('2026-11-06', '2026-12-06')).toBe(30);
    expect(diffDays('2026-12-06', '2026-11-06')).toBe(-30);
  });

  it('computes Monday-based weekdays and week starts', () => {
    expect(weekday('2026-11-02')).toBe(0); // Monday
    expect(weekday('2026-11-08')).toBe(6); // Sunday
    expect(startOfWeek('2026-11-06')).toBe('2026-11-02');
    expect(startOfWeek('2026-11-02')).toBe('2026-11-02');
    expect(startOfWeek('2026-11-08')).toBe('2026-11-02');
  });

  it('counts inclusive weeks between two dates', () => {
    expect(weeksBetween('2026-11-06', '2026-11-08')).toBe(1);
    expect(weeksBetween('2026-11-06', '2026-11-09')).toBe(2);
    expect(weeksBetween('2026-11-02', '2027-03-14')).toBe(19);
  });

  it('builds inclusive date ranges', () => {
    expect(dateRange('2026-11-06', '2026-11-08')).toEqual(['2026-11-06', '2026-11-07', '2026-11-08']);
    expect(dateRange('2026-11-08', '2026-11-06')).toEqual([]);
  });

  it('formats dates for humans', () => {
    expect(formatDate('2026-11-06')).toBe('6 Nov');
    expect(formatDate('2026-11-06', { weekday: true, year: true })).toBe('Fri 6 Nov 2026');
  });

  it('uses the local timezone for today()', () => {
    expect(today(new Date(2026, 10, 6, 23, 30))).toBe('2026-11-06');
  });

  it('addDays/diffDays round-trip for any date and offset', () => {
    fc.assert(
      fc.property(arbDate, fc.integer({ min: -5000, max: 5000 }), (d, n) => {
        const moved = addDays(d, n);
        expect(isLocalDate(moved)).toBe(true);
        expect(diffDays(d, moved)).toBe(n);
      }),
    );
  });

  it('startOfWeek is idempotent and always a Monday', () => {
    fc.assert(
      fc.property(arbDate, (d) => {
        const monday = startOfWeek(d);
        expect(weekday(monday)).toBe(0);
        expect(startOfWeek(monday)).toBe(monday);
        expect(diffDays(monday, d)).toBeGreaterThanOrEqual(0);
        expect(diffDays(monday, d)).toBeLessThan(7);
      }),
    );
  });
});

describe('date comparisons', () => {
  it('compares, picks min/max and checks ranges', async () => {
    const { compareDates, isBetween, maxDate, minDate } = await import('./dates');
    expect(compareDates('2026-01-01', '2026-01-02')).toBe(-1);
    expect(compareDates('2026-01-02', '2026-01-01')).toBe(1);
    expect(compareDates('2026-01-01', '2026-01-01')).toBe(0);
    expect(maxDate('2026-01-01', '2026-01-02')).toBe('2026-01-02');
    expect(minDate('2026-01-01', '2026-01-02')).toBe('2026-01-01');
    expect(isBetween('2026-01-05', '2026-01-01', '2026-01-10')).toBe(true);
    expect(isBetween('2026-01-11', '2026-01-01', '2026-01-10')).toBe(false);
  });
});
