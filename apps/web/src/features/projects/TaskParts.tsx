import { addWorkingDays, isWeekend, todayLocal, type TaskType } from '@davegantt/shared';
import { useState, type ButtonHTMLAttributes, type FormEvent } from 'react';
import { useCreateTask } from './api';
import { TextCell } from './cells';
import type { Row } from './rows';
import type { TaskActions } from './useTaskActions';

/** Expand toggle, milestone marker and editable name; Tab / Shift+Tab indent and outdent. */
export function NameCell({
  row,
  actions,
  canEdit,
}: {
  row: Row;
  actions: TaskActions;
  canEdit: boolean;
}) {
  const { task, depth, hasChildren } = row;
  const collapsed = actions.collapsed.has(task.id);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1" style={{ paddingLeft: depth * 18 }}>
      {hasChildren ? (
        <button
          type="button"
          aria-label={collapsed ? `Espandi ${task.name}` : `Comprimi ${task.name}`}
          aria-expanded={!collapsed}
          onClick={() => actions.toggle(task.id)}
          className="flex size-5 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-200"
        >
          <span className={`inline-block transition-transform ${collapsed ? '' : 'rotate-90'}`}>
            ▸
          </span>
        </button>
      ) : (
        <span className="size-5 shrink-0" />
      )}
      {task.type === 'MILESTONE' && (
        <span aria-label="Milestone" title="Milestone" className="text-amber-500">
          ◆
        </span>
      )}
      <TextCell
        value={task.name}
        label="Nome del task"
        disabled={!canEdit}
        className={hasChildren ? 'font-semibold' : ''}
        onCommit={(name) => actions.update(task.id, { name })}
        onKeyDown={(e) => {
          if (!canEdit || e.key !== 'Tab') return;
          e.preventDefault();
          e.currentTarget.blur();
          if (e.shiftKey) actions.outdent(task);
          else actions.indent(task);
        }}
      />
    </div>
  );
}

export function ReadOnlyDate({ value }: { value: string }) {
  const [y, m, d] = value.split('-');
  return <span className="block px-1.5 py-1 tabular-nums">{`${d}/${m}/${y}`}</span>;
}

export function IconButton({
  label,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`flex size-7 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent ${className}`}
      {...props}
    />
  );
}

export function ErrorBanner({ actions }: { actions: TaskActions }) {
  if (!actions.error) return null;
  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      <span>{actions.error}</span>
      <button
        type="button"
        className="text-red-500 hover:text-red-700"
        onClick={actions.clearError}
      >
        Chiudi
      </button>
    </div>
  );
}

const nextWorkingDay = (date: string) => (isWeekend(date) ? addWorkingDays(date, 1) : date);

export function AddTaskForm({
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
