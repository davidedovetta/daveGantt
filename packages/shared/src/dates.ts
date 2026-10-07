import { z } from 'zod';

/**
 * Calendar dates are `YYYY-MM-DD` strings everywhere. Arithmetic goes through UTC epoch days,
 * so no time zone or DST shift can move a date.
 */
export type CalendarDate = string;

const DAY_MS = 86_400_000;
const PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isCalendarDate(value: string): boolean {
  const m = PATTERN.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

export const calendarDateSchema = z
  .string()
  .refine(isCalendarDate, { message: 'Data non valida (formato AAAA-MM-GG)' });

function toEpochDay(date: CalendarDate): number {
  if (!isCalendarDate(date)) throw new Error(`Invalid calendar date: ${date}`);
  return (
    Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) /
    DAY_MS
  );
}

function fromEpochDay(day: number): CalendarDate {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  return fromEpochDay(toEpochDay(date) + days);
}

/** `b - a` in calendar days. */
export function diffDays(a: CalendarDate, b: CalendarDate): number {
  return toEpochDay(b) - toEpochDay(a);
}

export function compareDates(a: CalendarDate, b: CalendarDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function minDate(a: CalendarDate, b: CalendarDate): CalendarDate {
  return a <= b ? a : b;
}

export function maxDate(a: CalendarDate, b: CalendarDate): CalendarDate {
  return a >= b ? a : b;
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(date: CalendarDate): number {
  // Epoch day 0 (1970-01-01) was a Thursday.
  return (((toEpochDay(date) + 4) % 7) + 7) % 7;
}

export function isWeekend(date: CalendarDate): boolean {
  const dow = dayOfWeek(date);
  return dow === 0 || dow === 6;
}

/** Working days (Mon–Fri) in the inclusive range `[start, end]`; 0 if `end < start`. */
export function workingDaysBetween(start: CalendarDate, end: CalendarDate): number {
  const total = diffDays(start, end) + 1;
  if (total <= 0) return 0;
  const fullWeeks = Math.floor(total / 7);
  let count = fullWeeks * 5;
  const startDow = dayOfWeek(start);
  for (let i = 0; i < total % 7; i++) {
    const dow = (startDow + fullWeeks * 7 + i) % 7;
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

/**
 * Moves `days` working days from `date` (negative moves back). Weekends are skipped; starting
 * on a weekend counts from the adjacent working day in the direction of travel.
 */
export function addWorkingDays(date: CalendarDate, days: number): CalendarDate {
  const step = days >= 0 ? 1 : -1;
  let current = date;
  let remaining = Math.abs(days);
  while (remaining > 0) {
    current = addDays(current, step);
    if (!isWeekend(current)) remaining--;
  }
  return current;
}

/** Today's date in the local time zone of the caller (the browser for the web app). */
export function todayLocal(now: Date = new Date()): CalendarDate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
