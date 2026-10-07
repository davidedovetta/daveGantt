import {
  addDays,
  dayOfWeek,
  diffDays,
  isWeekend,
  maxDate,
  minDate,
  type CalendarDate,
} from '@davegantt/shared';

export type Zoom = 'day' | 'week' | 'month';

export const DAY_WIDTH: Record<Zoom, number> = { day: 28, week: 10, month: 3.5 };

/** Minimum visible span per zoom, so short projects still fill the screen. */
const MIN_DAYS: Record<Zoom, number> = { day: 70, week: 182, month: 400 };

export interface Scale {
  start: CalendarDate;
  /** Number of days shown (inclusive range `[start, start + days - 1]`). */
  days: number;
  dayWidth: number;
  width: number;
}

const mondayOf = (date: CalendarDate) => addDays(date, -((dayOfWeek(date) + 6) % 7));

/**
 * Visible range: from the Monday a week before the earliest task (or today) to at least four
 * weeks after the latest one, never shorter than the zoom's minimum.
 */
export function createScale(
  ranges: readonly { startDate: CalendarDate; endDate: CalendarDate }[],
  today: CalendarDate,
  zoom: Zoom,
): Scale {
  let first = today;
  let last = today;
  for (const r of ranges) {
    first = minDate(first, r.startDate);
    last = maxDate(last, r.endDate);
  }
  const start = mondayOf(addDays(first, -7));
  const days = Math.max(diffDays(start, addDays(last, 28)) + 1, MIN_DAYS[zoom]);
  const dayWidth = DAY_WIDTH[zoom];
  return { start, days, dayWidth, width: days * dayWidth };
}

/** Left edge of `date`'s column. */
export const xOf = (scale: Scale, date: CalendarDate) =>
  diffDays(scale.start, date) * scale.dayWidth;

/** Horizontal extent of an inclusive date range. */
export function barGeometry(scale: Scale, startDate: CalendarDate, endDate: CalendarDate) {
  const left = xOf(scale, startDate);
  return { left, width: (diffDays(startDate, endDate) + 1) * scale.dayWidth };
}

/** ISO 8601 week number. */
export function isoWeek(date: CalendarDate): number {
  const thursday = addDays(date, 3 - ((dayOfWeek(date) + 6) % 7));
  return Math.floor(diffDays(`${thursday.slice(0, 4)}-01-01`, thursday) / 7) + 1;
}

export interface HeaderCell {
  key: string;
  label: string;
  left: number;
  width: number;
  muted?: boolean;
  today?: boolean;
}

const monthName = (date: CalendarDate, month: 'long' | 'short') =>
  new Intl.DateTimeFormat('it-IT', { month, timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`),
  );

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Groups consecutive days sharing `keyOf` into header cells. */
function segments(
  scale: Scale,
  keyOf: (date: CalendarDate) => string,
  labelOf: (date: CalendarDate) => string,
  extra?: (date: CalendarDate) => Partial<HeaderCell>,
): HeaderCell[] {
  const cells: HeaderCell[] = [];
  for (let i = 0; i < scale.days; i++) {
    const date = addDays(scale.start, i);
    const key = keyOf(date);
    const lastCell = cells.at(-1);
    if (lastCell?.key === key) {
      lastCell.width += scale.dayWidth;
    } else {
      cells.push({
        key,
        label: labelOf(date),
        left: i * scale.dayWidth,
        width: scale.dayWidth,
        ...extra?.(date),
      });
    }
  }
  return cells;
}

/** Header rows, top to bottom. */
export function headerRows(scale: Scale, zoom: Zoom, today: CalendarDate): HeaderCell[][] {
  const months = (format: 'long' | 'short', withYear: boolean) =>
    segments(
      scale,
      (d) => d.slice(0, 7),
      (d) => {
        const name = format === 'long' ? capitalize(monthName(d, 'long')) : monthName(d, 'short');
        return withYear ? `${name} ${d.slice(0, 4)}` : name;
      },
    );
  const weeks = segments(scale, mondayOf, (d) => `S${isoWeek(d)}`);

  switch (zoom) {
    case 'day':
      return [
        months('long', true),
        weeks,
        segments(
          scale,
          (d) => d,
          (d) => String(Number(d.slice(8, 10))),
          (d) => ({ muted: isWeekend(d), today: d === today }),
        ),
      ];
    case 'week':
      return [months('long', true), weeks];
    case 'month':
      return [
        segments(
          scale,
          (d) => d.slice(0, 4),
          (d) => d.slice(0, 4),
        ),
        months('short', false),
      ];
  }
}

/** Saturdays in range (each weekend is drawn as a two-day band). */
export function weekendStarts(scale: Scale): CalendarDate[] {
  const result: CalendarDate[] = [];
  const firstSaturday = addDays(scale.start, (6 - dayOfWeek(scale.start) + 7) % 7);
  for (let d = firstSaturday; diffDays(scale.start, d) < scale.days; d = addDays(d, 7))
    result.push(d);
  return result;
}
