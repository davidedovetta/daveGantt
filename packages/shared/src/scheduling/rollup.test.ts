import { describe, expect, it } from 'vitest';
import { rollup, type RollupInput } from './rollup.js';

const task = (
  id: string,
  parentId: string | null,
  startDate: string,
  endDate: string,
  progress = 0,
  type: RollupInput['type'] = 'TASK',
): RollupInput => ({ id, parentId, type, startDate, endDate, progress });

describe('rollup', () => {
  it('keeps leaf values', () => {
    const r = rollup([task('a', null, '2026-10-05', '2026-10-09', 40)]);
    expect(r.get('a')).toEqual({
      startDate: '2026-10-05',
      endDate: '2026-10-09',
      progress: 40,
      isSummary: false,
    });
  });

  it('spans children and weights progress by working days', () => {
    const r = rollup([
      task('p', null, '2000-01-01', '2000-01-01', 99), // own values are ignored
      task('a', 'p', '2026-10-05', '2026-10-09', 100), // 5 working days
      task('b', 'p', '2026-10-12', '2026-10-12', 0), // 1 working day
    ]);
    expect(r.get('p')).toEqual({
      startDate: '2026-10-05',
      endDate: '2026-10-12',
      progress: 83,
      isSummary: true,
    });
  });

  it('combines nested levels using totals, not averages', () => {
    const r = rollup([
      task('root', null, '2026-10-05', '2026-10-05'),
      task('g', 'root', '2026-10-05', '2026-10-05'),
      task('a', 'g', '2026-10-05', '2026-10-05', 100), // 1 day
      task('b', 'g', '2026-10-06', '2026-10-06', 0), // 1 day
      task('c', 'root', '2026-10-07', '2026-10-08', 0), // 2 days
    ]);
    expect(r.get('g')?.progress).toBe(50);
    expect(r.get('root')).toMatchObject({
      startDate: '2026-10-05',
      endDate: '2026-10-08',
      progress: 25,
    });
  });

  it('falls back to a plain average when only milestones are below', () => {
    const r = rollup([
      task('p', null, '2026-10-05', '2026-10-05'),
      task('m1', 'p', '2026-10-05', '2026-10-05', 100, 'MILESTONE'),
      task('m2', 'p', '2026-10-09', '2026-10-09', 0, 'MILESTONE'),
    ]);
    expect(r.get('p')).toMatchObject({ endDate: '2026-10-09', progress: 50, isSummary: true });
  });

  it('detects cycles', () => {
    expect(() =>
      rollup([
        task('a', 'b', '2026-10-05', '2026-10-05'),
        task('b', 'a', '2026-10-05', '2026-10-05'),
      ]),
    ).toThrow(/cycle/);
  });
});
