import { compareKeys, rollup, type Task } from '@davegantt/shared';

export interface Row {
  task: Task;
  depth: number;
  hasChildren: boolean;
  /** Effective values: rolled up from subtasks for summaries, the task's own otherwise. */
  startDate: string;
  endDate: string;
  progress: number;
}

const byKey = (a: Task, b: Task) => compareKeys(a.sortKey, b.sortKey);

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

export interface MoveTarget {
  parentId: string | null;
  /** Sibling to place the task after; `null` = first child of `parentId`. */
  afterId: string | null;
}

export type DropPosition = 'before' | 'after';

/** Whether `taskId` is `ancestorId` itself or one of its descendants. */
export function isSelfOrDescendant(byId: Map<string, Task>, taskId: string, ancestorId: string) {
  for (let id: string | null = taskId; id !== null; id = byId.get(id)?.parentId ?? null) {
    if (id === ancestorId) return true;
  }
  return false;
}

/** Same parent and same previous sibling: the move would change nothing. */
function isNoOp(task: Task, target: MoveTarget, children: Map<string | null, Task[]>) {
  if (task.parentId !== target.parentId) return false;
  const siblings = children.get(task.parentId) ?? [];
  const index = siblings.findIndex((s) => s.id === task.id);
  return (siblings[index - 1]?.id ?? null) === target.afterId;
}

/**
 * Where `task` goes when dropped before or after `target`: it becomes a sibling of `target`,
 * except right below an expanded summary, where it becomes its first subtask (what the user
 * sees there). `null` when the drop is invalid (onto its own subtree) or changes nothing.
 */
export function dropTarget(
  task: Task,
  target: Task,
  position: DropPosition,
  children: Map<string | null, Task[]>,
  byId: Map<string, Task>,
  targetExpanded = false,
): MoveTarget | null {
  if (isSelfOrDescendant(byId, target.id, task.id)) return null;
  let result: MoveTarget;
  const targetHasChildren = (children.get(target.id)?.length ?? 0) > 0;
  if (position === 'after' && targetHasChildren && targetExpanded) {
    result = { parentId: target.id, afterId: null };
  } else if (position === 'after') {
    result = { parentId: target.parentId, afterId: target.id };
  } else {
    const siblings = (children.get(target.parentId) ?? []).filter((s) => s.id !== task.id);
    const index = siblings.findIndex((s) => s.id === target.id);
    result = { parentId: target.parentId, afterId: siblings[index - 1]?.id ?? null };
  }
  return isNoOp(task, result, children) ? null : result;
}

/** One step up or down among siblings (keyboard reordering), or `null` at the edge. */
export function stepTarget(
  task: Task,
  direction: 'up' | 'down',
  children: Map<string | null, Task[]>,
): MoveTarget | null {
  const siblings = children.get(task.parentId) ?? [];
  const index = siblings.findIndex((s) => s.id === task.id);
  if (direction === 'up') {
    if (index <= 0) return null;
    return { parentId: task.parentId, afterId: siblings[index - 2]?.id ?? null };
  }
  const next = siblings[index + 1];
  return next ? { parentId: task.parentId, afterId: next.id } : null;
}
