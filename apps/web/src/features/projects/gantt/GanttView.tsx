import { addDays, todayLocal } from '@davegantt/shared';
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { DateCell } from '../cells';
import type { Row } from '../rows';
import { IconButton, NameCell, ReadOnlyDate } from '../TaskParts';
import type { TaskActions } from '../useTaskActions';
import { applyDrag, daysFromPixels, type DateRange, type DragMode } from './drag';
import {
  barGeometry,
  createScale,
  headerRows,
  weekendStarts,
  xOf,
  type Scale,
  type Zoom,
} from './scale';

const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 60;
const LEFT_WIDTH = 500;

const ZOOM_LABELS: Record<Zoom, string> = { day: 'Giorni', week: 'Settimane', month: 'Mesi' };

/** Days of history left visible before today when (re)centering. */
const DAYS_BEFORE_TODAY: Record<Zoom, number> = { day: 7, week: 21, month: 60 };

export function GanttView({
  actions,
  color,
  canEdit,
}: {
  actions: TaskActions;
  color: string;
  canEdit: boolean;
}) {
  const [zoom, setZoom] = useState<Zoom>('day');
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = todayLocal();
  const { rows } = actions;

  const scale = useMemo(() => createScale(rows, today, zoom), [rows, today, zoom]);
  const header = useMemo(() => headerRows(scale, zoom, today), [scale, zoom, today]);

  const scrollToToday = () => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = Math.max(0, xOf(scale, addDays(today, -DAYS_BEFORE_TODAY[zoom])));
  };

  // Bring today into view when the page opens and whenever the zoom changes.
  useEffect(scrollToToday, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  const bodyHeight = Math.max(rows.length, 1) * ROW_HEIGHT;

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex items-center gap-2">
        <div
          className="flex rounded-md border border-slate-200 bg-white p-0.5"
          role="group"
          aria-label="Zoom"
        >
          {(Object.keys(ZOOM_LABELS) as Zoom[]).map((z) => (
            <button
              key={z}
              type="button"
              aria-pressed={zoom === z}
              onClick={() => setZoom(z)}
              className={`rounded px-2.5 py-1 text-xs font-medium ${
                zoom === z ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {ZOOM_LABELS[z]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={scrollToToday}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
        >
          Oggi
        </button>
        {canEdit && (
          <span className="ml-auto text-xs text-slate-400">
            Trascina una barra per spostarla, i bordi per cambiarne inizio e fine.
          </span>
        )}
      </div>

      <div
        ref={scrollRef}
        className="relative overflow-auto rounded-lg border border-slate-200 bg-white"
        style={{ maxHeight: 'calc(100vh - 240px)' }}
      >
        <div className="relative" style={{ width: LEFT_WIDTH + scale.width }}>
          {/* Header: sticky on top; its left part is also sticky on the left. */}
          <div className="sticky top-0 z-30 flex" style={{ height: HEADER_HEIGHT }}>
            <div
              className="sticky left-0 z-40 flex items-end border-r border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500"
              style={{ width: LEFT_WIDTH, minWidth: LEFT_WIDTH }}
            >
              <span className="flex-1 px-3 py-2 pl-9">Nome</span>
              <span className="w-[118px] px-2 py-2">Inizio</span>
              <span className="w-[118px] px-2 py-2">Fine</span>
              {canEdit && <span className="w-8" />}
            </div>
            <TimelineHeader rows={header} />
          </div>

          {/* Body */}
          <div className="relative">
            <TimelineBackground scale={scale} today={today} height={bodyHeight} zoom={zoom} />
            {rows.map((row) => (
              <div key={row.task.id} className="group flex" style={{ height: ROW_HEIGHT }}>
                <LeftCells row={row} actions={actions} canEdit={canEdit} />
                <div
                  className="relative border-b border-slate-100 group-hover:bg-indigo-50/30"
                  style={{ width: scale.width }}
                >
                  <TaskBar
                    // Remount when the dates change, dropping the finished drag preview.
                    key={`${row.startDate}|${row.endDate}`}
                    row={row}
                    scale={scale}
                    color={row.task.color ?? color}
                    canDrag={canEdit && !row.hasChildren}
                    onCommit={(range, onError) => {
                      const { task } = row;
                      actions.update(task.id, range, { onError });
                    }}
                  />
                </div>
              </div>
            ))}
            {rows.length === 0 && (
              <div className="flex" style={{ height: ROW_HEIGHT }}>
                <div
                  className="sticky left-0 z-10 flex items-center border-r border-slate-200 bg-white px-4 text-sm text-slate-500"
                  style={{ width: LEFT_WIDTH, minWidth: LEFT_WIDTH }}
                >
                  Nessun task.{canEdit ? ' Aggiungine uno qui sotto.' : ''}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LeftCells({
  row,
  actions,
  canEdit,
}: {
  row: Row;
  actions: TaskActions;
  canEdit: boolean;
}) {
  const { task, hasChildren } = row;
  return (
    <div
      className={`sticky left-0 z-20 flex items-center border-r border-b border-slate-200 border-b-slate-100 bg-white text-sm group-hover:bg-slate-50 ${
        hasChildren ? 'font-semibold' : ''
      }`}
      style={{ width: LEFT_WIDTH, minWidth: LEFT_WIDTH }}
    >
      <div className="flex min-w-0 flex-1 px-2">
        <NameCell row={row} actions={actions} canEdit={canEdit} />
      </div>
      <div className="w-[118px] font-normal">
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
      </div>
      <div className="w-[118px] font-normal">
        {hasChildren || task.type === 'MILESTONE' ? (
          <ReadOnlyDate value={row.endDate} />
        ) : (
          <DateCell
            value={task.endDate}
            label="Data di fine"
            disabled={!canEdit}
            onCommit={(d) => actions.changeEnd(task, d)}
          />
        )}
      </div>
      {canEdit && (
        <div className="w-8 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
          <IconButton
            label="Elimina"
            onClick={() => actions.remove(task)}
            className="hover:text-red-600"
          >
            ✕
          </IconButton>
        </div>
      )}
    </div>
  );
}

function TimelineHeader({ rows }: { rows: ReturnType<typeof headerRows> }) {
  const rowHeight = HEADER_HEIGHT / rows.length;
  return (
    <div className="relative flex-1 border-b border-slate-200 bg-white text-slate-600">
      {rows.map((cells, r) => (
        <div key={r} className="relative" style={{ height: rowHeight }}>
          {cells.map((c) => (
            <div
              key={c.key}
              // overflow-clip (not hidden): hidden would break the sticky label inside.
              className={`absolute top-0 flex h-full items-center overflow-clip border-l border-slate-100 whitespace-nowrap ${
                r === rows.length - 1 && rows.length === 3
                  ? 'justify-center text-[11px]'
                  : 'px-1.5 text-xs'
              } ${r === 0 ? 'font-semibold text-slate-800' : ''} ${c.muted ? 'bg-slate-50 text-slate-400' : ''} ${
                c.today ? 'rounded bg-amber-300 font-semibold text-slate-900' : ''
              }`}
              style={{ left: c.left, width: c.width }}
              title={c.label}
            >
              {/* Labels of cells that start off-screen stick to the visible edge. */}
              <span className="sticky" style={{ left: LEFT_WIDTH + 6 }}>
                {c.label}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function TimelineBackground({
  scale,
  today,
  height,
  zoom,
}: {
  scale: Scale;
  today: string;
  height: number;
  zoom: Zoom;
}) {
  const todayX = xOf(scale, today);
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-0"
      style={{
        left: LEFT_WIDTH,
        width: scale.width,
        height,
        // One faint line per day (day zoom) or per week (other zooms).
        backgroundImage: `linear-gradient(to right, rgb(241 245 249) 1px, transparent 1px)`,
        backgroundSize: `${zoom === 'day' ? scale.dayWidth : scale.dayWidth * 7}px 100%`,
      }}
    >
      {zoom !== 'month' &&
        weekendStarts(scale).map((sat) => (
          <div
            key={sat}
            className="absolute top-0 h-full bg-slate-100/70"
            style={{ left: xOf(scale, sat), width: scale.dayWidth * 2 }}
          />
        ))}
      {todayX >= 0 && todayX < scale.width && (
        <>
          <div
            className="absolute top-0 h-full bg-amber-100/50"
            style={{ left: todayX, width: scale.dayWidth }}
          />
          <div
            className="absolute top-0 h-full w-0.5 bg-amber-500"
            style={{ left: todayX + scale.dayWidth / 2 - 1 }}
          />
        </>
      )}
    </div>
  );
}

interface DragState {
  mode: DragMode;
  originX: number;
  deltaDays: number;
}

function TaskBar({
  row,
  scale,
  color,
  canDrag,
  onCommit,
}: {
  row: Row;
  scale: Scale;
  color: string;
  canDrag: boolean;
  onCommit: (range: DateRange, onError: () => void) => void;
}) {
  const [drag, setDrag] = useState<DragState | null>(null);
  // After release the preview stays until the new dates arrive (the bar is keyed by them).
  const [pending, setPending] = useState<DateRange | null>(null);

  const original = { startDate: row.startDate, endDate: row.endDate };
  const shown = drag ? applyDrag(original, drag.mode, drag.deltaDays) : (pending ?? original);
  const { task } = row;
  const isMilestone = task.type === 'MILESTONE';
  const { left, width } = barGeometry(scale, shown.startDate, shown.endDate);
  const top = (ROW_HEIGHT - 20) / 2;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!canDrag || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const handle = (e.target as HTMLElement).dataset['handle'] as DragMode | undefined;
    setDrag({ mode: isMilestone ? 'move' : (handle ?? 'move'), originX: e.clientX, deltaDays: 0 });
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const deltaDays = daysFromPixels(e.clientX - drag.originX, scale.dayWidth);
    if (deltaDays !== drag.deltaDays) setDrag({ ...drag, deltaDays });
  };
  const onPointerUp = () => {
    if (!drag) return;
    setDrag(null);
    if (drag.deltaDays === 0) return;
    const range = applyDrag(original, drag.mode, drag.deltaDays);
    setPending(range);
    onCommit(range, () => setPending(null));
  };

  const dragHandlers = canDrag
    ? { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: () => setDrag(null) }
    : {};
  const tooltip = `${task.name}\n${formatDate(shown.startDate)}${isMilestone ? '' : ` → ${formatDate(shown.endDate)}`}`;
  const label = (
    <span
      className="pointer-events-none absolute top-0 flex h-full items-center pl-2 text-xs whitespace-nowrap text-slate-700"
      style={{ left: isMilestone ? left + scale.dayWidth / 2 + 10 : left + width }}
    >
      {task.name}
    </span>
  );

  if (isMilestone) {
    const size = 14;
    return (
      <>
        <div
          {...dragHandlers}
          title={tooltip}
          className={`absolute rotate-45 rounded-[2px] border border-amber-600 bg-amber-400 ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
          style={{
            left: left + scale.dayWidth / 2 - size / 2,
            top: (ROW_HEIGHT - size) / 2,
            width: size,
            height: size,
          }}
        />
        {label}
      </>
    );
  }

  if (row.hasChildren) {
    return (
      <>
        <div title={tooltip} className="absolute" style={{ left, width, top: top + 4, height: 12 }}>
          <div className="h-2 rounded-sm bg-slate-600" />
          <div className="absolute top-0 left-0 h-0 w-0 border-t-[10px] border-r-[6px] border-t-slate-600 border-r-transparent" />
          <div className="absolute top-0 right-0 h-0 w-0 border-t-[10px] border-l-[6px] border-t-slate-600 border-l-transparent" />
        </div>
        {label}
      </>
    );
  }

  return (
    <>
      <div
        {...dragHandlers}
        title={tooltip}
        className={`absolute overflow-hidden rounded border shadow-sm ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''} ${
          drag ? 'opacity-80 ring-2 ring-indigo-300' : ''
        }`}
        style={{
          left,
          width: Math.max(width, 4),
          top,
          height: 20,
          background: `${color}40`,
          borderColor: color,
        }}
      >
        <div
          className="h-full"
          style={{ width: `${task.progress}%`, background: color, opacity: 0.85 }}
        />
        {canDrag && (
          <>
            <div
              data-handle="resize-start"
              className="absolute top-0 left-0 h-full w-2 cursor-ew-resize"
            />
            <div
              data-handle="resize-end"
              className="absolute top-0 right-0 h-full w-2 cursor-ew-resize"
            />
          </>
        )}
      </div>
      {label}
    </>
  );
}

function formatDate(date: string) {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}
