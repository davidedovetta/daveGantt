import { addDays, compareDates, type CalendarDate } from '@davegantt/shared';

export type DragMode = 'move' | 'resize-start' | 'resize-end';

export interface DateRange {
  startDate: CalendarDate;
  endDate: CalendarDate;
}

/** Whole days moved for a horizontal pointer delta. */
export const daysFromPixels = (dx: number, dayWidth: number) => Math.round(dx / dayWidth);

/** Dates after dragging by `deltaDays`. Resizing never makes a task shorter than one day. */
export function applyDrag(range: DateRange, mode: DragMode, deltaDays: number): DateRange {
  switch (mode) {
    case 'move':
      return {
        startDate: addDays(range.startDate, deltaDays),
        endDate: addDays(range.endDate, deltaDays),
      };
    case 'resize-start': {
      const startDate = addDays(range.startDate, deltaDays);
      return {
        startDate: compareDates(startDate, range.endDate) > 0 ? range.endDate : startDate,
        endDate: range.endDate,
      };
    }
    case 'resize-end': {
      const endDate = addDays(range.endDate, deltaDays);
      return {
        startDate: range.startDate,
        endDate: compareDates(endDate, range.startDate) < 0 ? range.startDate : endDate,
      };
    }
  }
}
