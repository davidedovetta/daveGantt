import { describe, expect, it } from 'vitest';
import { applyDrag, daysFromPixels } from './drag';

const range = { startDate: '2026-10-05', endDate: '2026-10-09' };

describe('applyDrag', () => {
  it('moves both dates', () => {
    expect(applyDrag(range, 'move', 3)).toEqual({ startDate: '2026-10-08', endDate: '2026-10-12' });
    expect(applyDrag(range, 'move', -5)).toEqual({
      startDate: '2026-09-30',
      endDate: '2026-10-04',
    });
  });

  it('resizes one edge and never inverts the range', () => {
    expect(applyDrag(range, 'resize-start', -2)).toEqual({
      startDate: '2026-10-03',
      endDate: '2026-10-09',
    });
    expect(applyDrag(range, 'resize-start', 10)).toEqual({
      startDate: '2026-10-09',
      endDate: '2026-10-09',
    });
    expect(applyDrag(range, 'resize-end', 3)).toEqual({
      startDate: '2026-10-05',
      endDate: '2026-10-12',
    });
    expect(applyDrag(range, 'resize-end', -10)).toEqual({
      startDate: '2026-10-05',
      endDate: '2026-10-05',
    });
  });
});

describe('daysFromPixels', () => {
  it('snaps to the nearest day', () => {
    expect(daysFromPixels(13, 28)).toBe(0);
    expect(daysFromPixels(15, 28)).toBe(1);
    expect(daysFromPixels(-43, 28)).toBe(-2);
  });
});
