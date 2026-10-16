import { addDays, diffDays, type Task } from '@davegantt/shared';
import { useMemo, useState, type DragEvent } from 'react';
import { ApiError, errorMessage } from '../../lib/api';
import { useDeleteTask, useMoveTask, useUpdateTask, type TaskChanges } from './api';
import {
  buildRows,
  childrenByParent,
  dropTarget,
  indentTarget,
  outdentTarget,
  stepTarget,
  type DropPosition,
  type MoveTarget,
} from './rows';

const CONFLICT_MESSAGE =
  'Il task è stato modificato da un altro utente nel frattempo: ho ricaricato i dati, riprova.';

export function describeTaskError(err: unknown) {
  return err instanceof ApiError && err.code === 'VERSION_CONFLICT'
    ? CONFLICT_MESSAGE
    : errorMessage(err);
}

/** Row model, collapse state and task mutations shared by the Gantt and list views. */
export function useTaskActions(projectId: string, tasks: Task[]) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{ taskId: string; position: DropPosition } | null>(null);

  const updateTask = useUpdateTask(projectId);
  const moveTask = useMoveTask(projectId);
  const deleteTask = useDeleteTask(projectId);

  const rows = useMemo(() => buildRows(tasks, collapsed), [tasks, collapsed]);
  const children = useMemo(() => childrenByParent(tasks), [tasks]);
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const reportError = (err: unknown) => setError(describeTaskError(err));

  const update = (taskId: string, changes: TaskChanges, options?: { onError?: () => void }) => {
    setError(null);
    updateTask.mutate(
      { taskId, changes },
      {
        onError: (err) => {
          reportError(err);
          options?.onError?.();
        },
      },
    );
  };

  const expand = (taskId: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });

  const move = (task: Task, target: MoveTarget | null) => {
    if (!target) return;
    setError(null);
    if (target.parentId) expand(target.parentId);
    moveTask.mutate({ taskId: task.id, ...target }, { onError: reportError });
  };

  const targetFor = (target: Task, position: DropPosition) => {
    const dragged = draggingId ? byId.get(draggingId) : undefined;
    if (!dragged) return null;
    return dropTarget(dragged, target, position, children, byId, !collapsed.has(target.id));
  };

  const endDrag = () => {
    setDraggingId(null);
    setDropHint(null);
  };

  return {
    rows,
    collapsed,
    error,
    clearError: () => setError(null),
    reportError,
    update,

    toggle: (taskId: string) =>
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (!next.delete(taskId)) next.add(taskId);
        return next;
      }),

    moveUp: (task: Task) => move(task, stepTarget(task, 'up', children)),
    moveDown: (task: Task) => move(task, stepTarget(task, 'down', children)),

    /** Props for the drag handle of a row (native HTML drag and drop). */
    dragHandleProps: (task: Task) => ({
      draggable: true,
      onDragStart: (e: DragEvent<HTMLElement>) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', task.id);
        const row = e.currentTarget.closest('[data-task-row]');
        if (row) e.dataTransfer.setDragImage(row, 12, 12);
        setDraggingId(task.id);
      },
      onDragEnd: endDrag,
    }),

    /** Props for a row that accepts drops; the upper half means "before", the lower "after". */
    dropZoneProps: (task: Task) => ({
      'data-task-row': '',
      'data-dragging': draggingId === task.id ? 'true' : undefined,
      'data-drop': dropHint?.taskId === task.id ? dropHint.position : undefined,
      onDragOver: (e: DragEvent<HTMLElement>) => {
        if (!draggingId) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const position: DropPosition = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
        if (!targetFor(task, position)) {
          if (dropHint?.taskId === task.id) setDropHint(null);
          return;
        }
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dropHint?.taskId !== task.id || dropHint.position !== position) {
          setDropHint({ taskId: task.id, position });
        }
      },
      onDrop: (e: DragEvent<HTMLElement>) => {
        e.preventDefault();
        const dragged = draggingId ? byId.get(draggingId) : undefined;
        const target = dropHint?.taskId === task.id ? targetFor(task, dropHint.position) : null;
        endDrag();
        if (dragged) move(dragged, target);
      },
    }),

    canIndent: (task: Task) => indentTarget(task, children) !== null,
    indent: (task: Task) => move(task, indentTarget(task, children)),
    outdent: (task: Task) => move(task, outdentTarget(task, byId)),

    remove: (task: Task) => {
      const subtasks = countDescendants(task.id, children);
      const question =
        subtasks > 0
          ? `Eliminare «${task.name}» e i suoi ${subtasks} sottotask?`
          : `Eliminare «${task.name}»?`;
      if (!window.confirm(question)) return;
      setError(null);
      deleteTask.mutate(task.id, { onError: reportError });
    },

    /** Changing the start moves the task, keeping its length in calendar days. */
    changeStart: (task: Task, startDate: string) =>
      update(task.id, {
        startDate,
        endDate: addDays(startDate, diffDays(task.startDate, task.endDate)),
      }),

    changeEnd: (task: Task, endDate: string) => {
      if (endDate < task.startDate) {
        setError('La data di fine non può precedere la data di inizio.');
        return;
      }
      update(task.id, { endDate });
    },
  };
}

export type TaskActions = ReturnType<typeof useTaskActions>;

function countDescendants(taskId: string, children: Map<string | null, Task[]>): number {
  return (children.get(taskId) ?? []).reduce(
    (sum, child) => sum + 1 + countDescendants(child.id, children),
    0,
  );
}
