import { workingDaysBetween, type Member } from '@davegantt/shared';
import { DateCell, ProgressCell } from './cells';
import type { Row } from './rows';
import { IconButton, NameCell, ReadOnlyDate } from './TaskParts';
import type { TaskActions } from './useTaskActions';

export function TaskTable({
  actions,
  members,
  canEdit,
}: {
  actions: TaskActions;
  members: Member[];
  canEdit: boolean;
}) {
  return (
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
          {actions.rows.map((row, index) => (
            <TaskRow
              key={row.task.id}
              row={row}
              index={index + 1}
              actions={actions}
              members={members}
              canEdit={canEdit}
            />
          ))}
          {actions.rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                Nessun task.{canEdit ? ' Aggiungi il primo qui sotto.' : ''}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function TaskRow({
  row,
  index,
  actions,
  members,
  canEdit,
}: {
  row: Row;
  index: number;
  actions: TaskActions;
  members: Member[];
  canEdit: boolean;
}) {
  const { task, hasChildren } = row;
  const isMilestone = task.type === 'MILESTONE';
  const duration = isMilestone ? 0 : workingDaysBetween(row.startDate, row.endDate);

  return (
    <tr
      className={`group border-t border-slate-100 hover:bg-slate-50/70 ${hasChildren ? 'font-semibold' : ''}`}
    >
      <td className="px-2 py-1 text-right text-xs font-normal text-slate-400 tabular-nums">
        {index}
      </td>
      <td className="px-2 py-1">
        <NameCell row={row} actions={actions} canEdit={canEdit} />
      </td>
      <td className="px-2 py-1">
        {hasChildren ? (
          <ReadOnlyDate value={row.startDate} />
        ) : (
          <DateCell
            value={task.startDate}
            label="Data di inizio"
            disabled={!canEdit}
            onCommit={(d) => actions.changeStart(task, d)}
          />
        )}
      </td>
      <td className="px-2 py-1">
        {hasChildren || isMilestone ? (
          <ReadOnlyDate value={row.endDate} />
        ) : (
          <DateCell
            value={task.endDate}
            label="Data di fine"
            disabled={!canEdit}
            onCommit={(d) => actions.changeEnd(task, d)}
          />
        )}
      </td>
      <td className="px-2 py-1 text-right font-normal text-slate-600 tabular-nums">
        {isMilestone ? '—' : `${duration} gg`}
      </td>
      <td className="px-2 py-1 font-normal">
        {hasChildren ? (
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
            onCommit={(progress) => actions.update(task.id, { progress })}
          />
        )}
      </td>
      <td className="px-2 py-1 font-normal">
        <select
          aria-label="Assegnatario"
          value={task.assigneeId ?? ''}
          disabled={!canEdit}
          onChange={(e) => actions.update(task.id, { assigneeId: e.target.value || null })}
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
              onClick={() => actions.outdent(task)}
            >
              ⇤
            </IconButton>
            <IconButton
              label="Rientra come sottotask (Tab)"
              disabled={!actions.canIndent(task)}
              onClick={() => actions.indent(task)}
            >
              ⇥
            </IconButton>
            <IconButton
              label="Elimina"
              onClick={() => actions.remove(task)}
              className="hover:text-red-600"
            >
              ✕
            </IconButton>
          </div>
        </td>
      )}
    </tr>
  );
}
