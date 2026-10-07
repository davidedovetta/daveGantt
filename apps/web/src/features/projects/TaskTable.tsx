import {
  addDays,
  addWorkingDays,
  diffDays,
  isWeekend,
  todayLocal,
  workingDaysBetween,
  type Member,
  type Task,
  type TaskType,
} from '@davegantt/shared';
import { useMemo, useState, type FormEvent } from 'react';
import { ApiError, errorMessage } from '../../lib/api';
import { useCreateTask, useDeleteTask, useMoveTask, useUpdateTask, type TaskChanges } from './api';
import { DateCell, ProgressCell, TextCell } from './cells';
import { buildRows, childrenByParent, indentTarget, outdentTarget, type Row } from './rows';

const CONFLICT_MESSAGE =
  'Il task è stato modificato da un altro utente nel frattempo: ho ricaricato i dati, riprova.';

function describeError(err: unknown) {
  return err instanceof ApiError && err.code === 'VERSION_CONFLICT'
    ? CONFLICT_MESSAGE
    : errorMessage(err);
}

export function TaskTable({
  projectId,
  tasks,
  members,
  canEdit,
}: {
  projectId: string;
  tasks: Task[];
  members: Member[];
  canEdit: boolean;
}) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const updateTask = useUpdateTask(projectId);
  const moveTask = useMoveTask(projectId);
  const deleteTask = useDeleteTask(projectId);

  const rows = useMemo(() => buildRows(tasks, collapsed), [tasks, collapsed]);
  const children = useMemo(() => childrenByParent(tasks), [tasks]);
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const onError = (err: unknown) => setError(describeError(err));

  const update = (taskId: string, changes: TaskChanges) => {
    setError(null);
    updateTask.mutate({ taskId, changes }, { onError });
  };

  const toggle = (taskId: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(taskId)) next.add(taskId);
      return next;
    });

  const move = (task: Task, target: { parentId: string | null; afterId: string | null } | null) => {
    if (!target) return;
    setError(null);
    if (target.parentId) {
      const parentId = target.parentId;
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(parentId);
        return next;
      });
    }
    moveTask.mutate({ taskId: task.id, ...target }, { onError });
  };

  const remove = (task: Task) => {
    const subtasks = countDescendants(task.id, children);
    const question =
      subtasks > 0
        ? `Eliminare «${task.name}» e i suoi ${subtasks} sottotask?`
        : `Eliminare «${task.name}»?`;
    if (!window.confirm(question)) return;
    setError(null);
    deleteTask.mutate(task.id, { onError });
  };

  /** Changing the start moves the task, keeping its length in calendar days. */
  const changeStart = (row: Row, startDate: string) => {
    const length = diffDays(row.task.startDate, row.task.endDate);
    update(row.task.id, { startDate, endDate: addDays(startDate, length) });
  };

  const changeEnd = (row: Row, endDate: string) => {
    if (endDate < row.task.startDate) {
      setError('La data di fine non può precedere la data di inizio.');
      return;
    }
    update(row.task.id, { endDate });
  };

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          <span>{error}</span>
          <button
            type="button"
            className="text-red-500 hover:text-red-700"
            onClick={() => setError(null)}
          >
            Chiudi
          </button>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[56rem] border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
            <tr>
              <th className="w-10 px-2 py-2 text-right font-semibold">#</th>
              <th className="px-2 py-2">Nome</th>
              <th className="w-36 px-2 py-2">Inizio</th>
              <th className="w-36 px-2 py-2">Fine</th>
              <th className="w-20 px-2 py-2 text-right">Durata</th>
              <th className="w-40 px-2 py-2">Avanzamento</th>
              <th className="w-44 px-2 py-2">Assegnatario</th>
              {canEdit && (
                <th className="w-28 px-2 py-2">
                  <span className="sr-only">Azioni</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <TaskRow
                key={row.task.id}
                row={row}
                index={index + 1}
                members={members}
                canEdit={canEdit}
                collapsed={collapsed.has(row.task.id)}
                onToggle={() => toggle(row.task.id)}
                onRename={(name) => update(row.task.id, { name })}
                onChangeStart={(d) => changeStart(row, d)}
                onChangeEnd={(d) => changeEnd(row, d)}
                onChangeProgress={(progress) => update(row.task.id, { progress })}
                onChangeAssignee={(assigneeId) => update(row.task.id, { assigneeId })}
                onIndent={() => move(row.task, indentTarget(row.task, children))}
                onOutdent={() => move(row.task, outdentTarget(row.task, byId))}
                onDelete={() => remove(row.task)}
                canIndent={indentTarget(row.task, children) !== null}
              />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  Nessun task.{canEdit ? ' Aggiungi il primo qui sotto.' : ''}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {canEdit && <AddTaskForm projectId={projectId} onError={onError} />}
    </div>
  );
}

function TaskRow({
  row,
  index,
  members,
  canEdit,
  collapsed,
  canIndent,
  onToggle,
  onRename,
  onChangeStart,
  onChangeEnd,
  onChangeProgress,
  onChangeAssignee,
  onIndent,
  onOutdent,
  onDelete,
}: {
  row: Row;
  index: number;
  members: Member[];
  canEdit: boolean;
  collapsed: boolean;
  canIndent: boolean;
  onToggle: () => void;
  onRename: (name: string) => void;
  onChangeStart: (date: string) => void;
  onChangeEnd: (date: string) => void;
  onChangeProgress: (progress: number) => void;
  onChangeAssignee: (assigneeId: string | null) => void;
  onIndent: () => void;
  onOutdent: () => void;
  onDelete: () => void;
}) {
  const { task, depth, hasChildren } = row;
  const isMilestone = task.type === 'MILESTONE';
  // Summaries show rolled-up values computed from their subtasks.
  const derived = hasChildren;
  const duration = isMilestone ? 0 : workingDaysBetween(row.startDate, row.endDate);

  return (
    <tr
      className={`group border-t border-slate-100 hover:bg-slate-50/70 ${hasChildren ? 'font-semibold' : ''}`}
    >
      <td className="px-2 py-1 text-right text-xs font-normal text-slate-400 tabular-nums">
        {index}
      </td>
      <td className="px-2 py-1">
        <div className="flex items-center gap-1" style={{ paddingLeft: depth * 20 }}>
          {hasChildren ? (
            <button
              type="button"
              aria-label={collapsed ? `Espandi ${task.name}` : `Comprimi ${task.name}`}
              aria-expanded={!collapsed}
              onClick={onToggle}
              className="flex size-5 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-200"
            >
              <span className={`inline-block transition-transform ${collapsed ? '' : 'rotate-90'}`}>
                ▸
              </span>
            </button>
          ) : (
            <span className="size-5 shrink-0" />
          )}
          {isMilestone && (
            <span aria-label="Milestone" title="Milestone" className="text-amber-500">
              ◆
            </span>
          )}
          <TextCell
            value={task.name}
            label="Nome del task"
            disabled={!canEdit}
            className={hasChildren ? 'font-semibold' : ''}
            onCommit={onRename}
            onKeyDown={(e) => {
              if (!canEdit || e.key !== 'Tab') return;
              e.preventDefault();
              e.currentTarget.blur();
              if (e.shiftKey) onOutdent();
              else onIndent();
            }}
          />
        </div>
      </td>
      <td className="px-2 py-1">
        {derived ? (
          <ReadOnlyDate value={row.startDate} />
        ) : (
          <DateCell
            value={task.startDate}
            label="Data di inizio"
            disabled={!canEdit}
            onCommit={onChangeStart}
          />
        )}
      </td>
      <td className="px-2 py-1">
        {derived || isMilestone ? (
          <ReadOnlyDate value={row.endDate} />
        ) : (
          <DateCell
            value={task.endDate}
            label="Data di fine"
            disabled={!canEdit}
            onCommit={onChangeEnd}
          />
        )}
      </td>
      <td className="px-2 py-1 text-right font-normal text-slate-600 tabular-nums">
        {isMilestone ? '—' : `${duration} gg`}
      </td>
      <td className="px-2 py-1 font-normal">
        {derived ? (
          <div className="flex items-center gap-2 px-1.5">
            <div className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-200" aria-hidden>
              <div className="h-full bg-indigo-500" style={{ width: `${row.progress}%` }} />
            </div>
            <span className="tabular-nums">{row.progress}%</span>
          </div>
        ) : (
          <ProgressCell
            value={task.progress}
            label="Avanzamento"
            disabled={!canEdit}
            onCommit={onChangeProgress}
          />
        )}
      </td>
      <td className="px-2 py-1 font-normal">
        <select
          aria-label="Assegnatario"
          value={task.assigneeId ?? ''}
          disabled={!canEdit}
          onChange={(e) => onChangeAssignee(e.target.value || null)}
          className="w-full rounded border border-transparent bg-transparent px-1 py-1 text-sm hover:border-slate-200 focus:border-indigo-400 focus:outline-none disabled:hover:border-transparent"
        >
          <option value="">—</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
            </option>
          ))}
        </select>
      </td>
      {canEdit && (
        <td className="px-2 py-1">
          <div className="flex justify-end gap-0.5 font-normal opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
            <IconButton
              label="Riduci rientro (Maiusc+Tab)"
              disabled={task.parentId === null}
              onClick={onOutdent}
            >
              ⇤
            </IconButton>
            <IconButton
              label="Rientra come sottotask (Tab)"
              disabled={!canIndent}
              onClick={onIndent}
            >
              ⇥
            </IconButton>
            <IconButton label="Elimina" onClick={onDelete} className="hover:text-red-600">
              ✕
            </IconButton>
          </div>
        </td>
      )}
    </tr>
  );
}

function ReadOnlyDate({ value }: { value: string }) {
  const [y, m, d] = value.split('-');
  return <span className="block px-1.5 py-1 tabular-nums">{`${d}/${m}/${y}`}</span>;
}

function IconButton({
  label,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`flex size-7 items-center justify-center rounded text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent ${className}`}
      {...props}
    />
  );
}

function AddTaskForm({
  projectId,
  onError,
}: {
  projectId: string;
  onError: (err: unknown) => void;
}) {
  const create = useCreateTask(projectId);
  const [name, setName] = useState('');
  const [type, setType] = useState<TaskType>('TASK');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const startDate = nextWorkingDay(todayLocal());
    // New tasks last one working week; milestones are a single day.
    const endDate = type === 'MILESTONE' ? startDate : addWorkingDays(startDate, 4);
    create.mutate({ name, type, startDate, endDate }, { onSuccess: () => setName(''), onError });
  };

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl gap-2">
      <input
        aria-label="Nome del nuovo task"
        placeholder="+ Aggiungi un task e premi Invio"
        className="min-w-0 flex-1 rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm focus:border-solid focus:border-indigo-500 focus:outline-none"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <select
        aria-label="Tipo"
        value={type}
        onChange={(e) => setType(e.target.value as TaskType)}
        className="rounded-md border border-slate-300 bg-white px-2 text-sm"
      >
        <option value="TASK">Task</option>
        <option value="MILESTONE">Milestone</option>
      </select>
      <button
        type="submit"
        disabled={create.isPending || !name.trim()}
        className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-300"
      >
        Aggiungi
      </button>
    </form>
  );
}

const nextWorkingDay = (date: string) => (isWeekend(date) ? addWorkingDays(date, 1) : date);

function countDescendants(taskId: string, children: Map<string | null, Task[]>): number {
  return (children.get(taskId) ?? []).reduce(
    (sum, child) => sum + 1 + countDescendants(child.id, children),
    0,
  );
}
