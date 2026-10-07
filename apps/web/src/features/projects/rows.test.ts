import type { Task } from '@davegantt/shared';
import { describe, expect, it } from 'vitest';
import { buildRows, childrenByParent, indentTarget, outdentTarget } from './rows';

let n = 0;
const task = (
  name: string,
  sortKey: string,
  parentId: string | null = null,
  extra: Partial<Task> = {},
): Task => ({
  id: name,
  projectId: 'p',
  parentId,
  type: 'TASK',
  name,
  description: '',
  startDate: '2026-10-05',
  endDate: '2026-10-09',
  progress: 0,
  status: 'TODO',
  color: null,
  assigneeId: null,
  sortKey,
  version: ++n,
  ...extra,
});

const tasks = [
  task('B', 'a1'),
  task('A', 'a0'),
  task('A2', 'a1', 'A', { startDate: '2026-10-12', endDate: '2026-10-16', progress: 100 }),
  task('A1', 'a0', 'A'),
  // Byte order: 'Zz' sorts before 'a0'.
  task('Z', 'Zz'),
];

describe('buildRows', () => {
  it('orders depth-first by sort key (byte-wise) with depth and rollup', () => {
    const rows = buildRows(tasks, new Set());
    expect(rows.map((r) => `${r.depth}:${r.task.name}`)).toEqual([
      '0:Z',
      '0:A',
      '1:A1',
      '1:A2',
      '0:B',
    ]);
    const a = rows.find((r) => r.task.id === 'A')!;
    expect(a).toMatchObject({
      hasChildren: true,
      startDate: '2026-10-05',
      endDate: '2026-10-16',
      progress: 50,
    });
  });

  it('hides descendants of collapsed tasks', () => {
    expect(buildRows(tasks, new Set(['A'])).map((r) => r.task.name)).toEqual(['Z', 'A', 'B']);
  });

  it('treats orphans as roots', () => {
    expect(buildRows([task('X', 'a0', 'missing')], new Set()).map((r) => r.depth)).toEqual([0]);
  });
});

describe('indent / outdent targets', () => {
  const children = childrenByParent(tasks);
  const byId = new Map(tasks.map((t) => [t.id, t]));

  it('indents under the previous sibling, after its last child', () => {
    expect(indentTarget(byId.get('B')!, children)).toEqual({ parentId: 'A', afterId: 'A2' });
    expect(indentTarget(byId.get('A2')!, children)).toEqual({ parentId: 'A1', afterId: null });
    expect(indentTarget(byId.get('Z')!, children)).toBeNull();
  });

  it('never indents under a milestone', () => {
    const list = [task('M', 'a0', null, { type: 'MILESTONE' }), task('T', 'a1')];
    expect(indentTarget(list[1]!, childrenByParent(list))).toBeNull();
  });

  it('outdents to right after the parent', () => {
    expect(outdentTarget(byId.get('A1')!, byId)).toEqual({ parentId: null, afterId: 'A' });
    expect(outdentTarget(byId.get('A')!, byId)).toBeNull();
  });
});
