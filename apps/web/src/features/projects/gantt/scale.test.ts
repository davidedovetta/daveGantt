import { describe, expect, it } from 'vitest';
import { barGeometry, createScale, headerRows, isoWeek, weekendStarts, xOf } from './scale';

describe('createScale', () => {
  it('starts on the Monday a week before the earliest date', () => {
    const s = createScale(
      [{ startDate: '2026-10-07', endDate: '2026-10-09' }],
      '2026-10-20',
      'day',
    );
    expect(s.start).toBe('2026-09-28'); // Monday
    expect(s.dayWidth).toBe(28);
  });

  it('covers four weeks past the latest date and the zoom minimum', () => {
    const s = createScale(
      [{ startDate: '2026-10-05', endDate: '2027-06-30' }],
      '2026-10-05',
      'day',
    );
    expect(xOf(s, '2027-07-28')).toBeLessThan(s.width);
    const short = createScale([], '2026-10-07', 'month');
    expect(short.days).toBe(400);
  });
});

describe('geometry', () => {
  const s = createScale([], '2026-10-07', 'day'); // starts 2026-09-28
  it('maps dates to columns, end date inclusive', () => {
    expect(xOf(s, '2026-09-28')).toBe(0);
    expect(barGeometry(s, '2026-09-29', '2026-10-01')).toEqual({ left: 28, width: 84 });
    expect(barGeometry(s, '2026-10-01', '2026-10-01').width).toBe(28);
  });
});

describe('isoWeek', () => {
  it('follows ISO 8601, including year boundaries', () => {
    expect(isoWeek('2026-10-07')).toBe(41);
    expect(isoWeek('2026-01-01')).toBe(1); // Thursday
    expect(isoWeek('2027-01-01')).toBe(53); // Friday of 2026-W53
    expect(isoWeek('2024-12-30')).toBe(1); // Monday of 2025-W01
  });
});

describe('headerRows', () => {
  const s = createScale([], '2026-10-07', 'day');
  it('builds month, week and day rows for the day zoom', () => {
    const [months, weeks, days] = headerRows(s, 'day', '2026-10-07');
    expect(months![0]).toMatchObject({ label: 'Settembre 2026', left: 0, width: 3 * 28 });
    expect(months![1]).toMatchObject({ label: 'Ottobre 2026', left: 3 * 28 });
    expect(weeks![0]).toMatchObject({ label: 'S40', width: 7 * 28 });
    expect(days![5]).toMatchObject({ label: '3', muted: true }); // Saturday 3 Oct
    expect(days!.find((d) => d.today)?.label).toBe('7');
  });

  it('uses years and short months for the month zoom', () => {
    const [years, months] = headerRows(
      createScale([], '2026-10-07', 'month'),
      'month',
      '2026-10-07',
    );
    expect(years![0]!.label).toBe('2026');
    expect(months![0]!.label).toBe('set');
  });
});

describe('weekendStarts', () => {
  it('lists every Saturday in range', () => {
    const s = createScale([], '2026-10-07', 'day');
    const sats = weekendStarts(s);
    expect(sats[0]).toBe('2026-10-03');
    expect(sats[1]).toBe('2026-10-10');
  });
});
