import type { CalendarDate } from '@davegantt/shared';

// Postgres DATE columns map to JS Dates at UTC midnight; these are the only conversions.
export const toDbDate = (date: CalendarDate) => new Date(`${date}T00:00:00.000Z`);
export const fromDbDate = (date: Date): CalendarDate => date.toISOString().slice(0, 10);
