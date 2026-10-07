import { rollup, type Task } from '@davegantt/shared';

export interface Row {
  task: Task;
  depth: number;
  hasChildren: boolean;
  /** Effective values: rolled up from subtasks for summaries, the task's own otherwise. */
  startDate: string;
  endDate: string;
  progress: number;
}

const byKey = (a: Task, b: Task) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0);

/** Children of every parent (`null` = roots), sorted by `sortKey`. Orphans count as roots. */
export function childrenByParent(tasks: readonly Task[]): Map<string | null, Task[]> {
  const ids = new Set(tasks.map((t) => t.id));
  const map = new Map<string | null, Task[]>();
  for (const t of tasks) {
    const parent = t.parentId !== null && ids.has(t.parentId) ? t.parentId : null;
    const list = map.get(parent);
    if (list) list.push(t);
    else map.set(parent, [t]);
  }
  for (const list of map.values()) list.sort(byKey);
  return map;
}

/** Depth-first visible rows; descendants of collapsed tasks are skipped. */
export function buildRows(tasks: readonly Task[], collapsed: ReadonlySet<string>): Row[] {
  const children = childrenByParent(tasks);
  const ids = new Set(tasks.map((t) => t.id));
  const rolled = rollup(
    tasks.map((t) => ({
      ...t,
      parentId: t.parentId !== null && ids.has(t.parentId) ? t.parentId : null,
    })),
  );
  const rows: Row[] = [];
  const visit = (parent: string | null, depth: number) => {
    for (const task of children.get(parent) ?? []) {
      const r = rolled.get(task.id)!;
      const hasChildren = (children.get(task.id)?.length ?? 0) > 0;
      rows.push({
        task,
        depth,
        hasChildren,
        startDate: r.startDate,
        endDate: r.endDate,
        progress: r.progress,
      });
      if (hasChildren && !collapsed.has(task.id)) visit(task.id, depth + 1);
    }
  };
  visit(null, 0);
  return rows;
}

/** Target of an indent (become last child of the previous sibling), or `null` if impossible. */
export function indentTarget(task: Task, children: Map<string | null, Task[]>) {
  const siblings = children.get(task.parentId) ?? [];
  const index = siblings.findIndex((s) => s.id === task.id);
  const previous = siblings[index - 1];
  if (!previous || previous.type === 'MILESTONE') return null;
  const lastChild = children.get(previous.id)?.at(-1);
  return { parentId: previous.id, afterId: lastChild?.id ?? null };
}

/** Target of an outdent (become the next sibling of the current parent), or `null`. */
export function outdentTarget(task: Task, byId: Map<string, Task>) {
  if (task.parentId === null) return null;
  const parent = byId.get(task.parentId);
  if (!parent) return null;
  return { parentId: parent.parentId, afterId: parent.id };
}
