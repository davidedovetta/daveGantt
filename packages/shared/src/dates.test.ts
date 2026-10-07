import { describe, expect, it } from 'vitest';
import {
  addDays,
  addWorkingDays,
  calendarDateSchema,
  dayOfWeek,
  diffDays,
  isCalendarDate,
  isWeekend,
  todayLocal,
  workingDaysBetween,
} from './dates.js';

describe('isCalendarDate', () => {
  it('accepts real dates, including leap days', () => {
    expect(isCalendarDate('2026-10-07')).toBe(true);
    expect(isCalendarDate('2028-02-29')).toBe(true);
  });
  it('rejects impossible or malformed dates', () => {
    for (const bad of ['2026-02-29', '2026-13-01', '2026-04-31', '2026-1-01', '07/10/2026', '']) {
      expect(isCalendarDate(bad)).toBe(false);
    }
    expect(calendarDateSchema.safeParse('2026-02-30').success).toBe(false);
  });
});

describe('addDays / diffDays', () => {
  it('crosses month, year and leap boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('is not affected by DST changes', () => {
    // Europe/Rome switches to CEST on 2026-03-29 and back on 2026-10-25.
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(diffDays('2026-10-24', '2026-10-26')).toBe(2);
  });
  it('computes signed differences', () => {
    expect(diffDays('2026-10-07', '2026-10-07')).toBe(0);
    expect(diffDays('2026-10-10', '2026-10-07')).toBe(-3);
    expect(diffDays('2024-01-01', '2025-01-01')).toBe(366);
  });
});

describe('weekdays', () => {
  it('knows the day of the week', () => {
    expect(dayOfWeek('2026-10-07')).toBe(3); // Wednesday
    expect(dayOfWeek('1969-12-28')).toBe(0); // Sunday, before epoch
    expect(isWeekend('2026-10-10')).toBe(true);
    expect(isWeekend('2026-10-11')).toBe(true);
    expect(isWeekend('2026-10-12')).toBe(false);
  });
});

describe('workingDaysBetween', () => {
  it('counts Mon–Fri in an inclusive range', () => {
    expect(workingDaysBetween('2026-10-05', '2026-10-09')).toBe(5); // Mon–Fri
    expect(workingDaysBetween('2026-10-05', '2026-10-11')).toBe(5); // Mon–Sun
    expect(workingDaysBetween('2026-10-05', '2026-10-12')).toBe(6);
    expect(workingDaysBetween('2026-10-07', '2026-10-07')).toBe(1);
    expect(workingDaysBetween('2026-10-10', '2026-10-11')).toBe(0); // weekend only
    expect(workingDaysBetween('2026-10-09', '2026-10-05')).toBe(0); // reversed
    expect(workingDaysBetween('2026-01-01', '2026-12-31')).toBe(261);
  });
});

describe('addWorkingDays', () => {
  it('skips weekends in both directions', () => {
    expect(addWorkingDays('2026-10-09', 1)).toBe('2026-10-12'); // Fri → Mon
    expect(addWorkingDays('2026-10-12', -1)).toBe('2026-10-09'); // Mon → Fri
    expect(addWorkingDays('2026-10-07', 5)).toBe('2026-10-14');
    expect(addWorkingDays('2026-10-07', 0)).toBe('2026-10-07');
    expect(addWorkingDays('2026-10-10', 1)).toBe('2026-10-12'); // Sat → Mon
  });
});

describe('todayLocal', () => {
  it('uses local date components', () => {
    expect(todayLocal(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
