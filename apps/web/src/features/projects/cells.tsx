import { isCalendarDate } from '@davegantt/shared';
import type { KeyboardEvent } from 'react';

// Inputs are uncontrolled and keyed by the server value: a new value from the server (own
// save or a colleague's change) remounts the input, discarding any stale draft.

const cellInput =
  'w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm hover:border-slate-200 focus:border-indigo-400 focus:bg-white focus:outline-none disabled:hover:border-transparent';

function blurOnEnterRevertOnEscape(e: KeyboardEvent<HTMLInputElement>, original: string) {
  if (e.key === 'Enter') e.currentTarget.blur();
  if (e.key === 'Escape') {
    e.currentTarget.value = original;
    e.currentTarget.blur();
  }
}

export function TextCell({
  value,
  label,
  disabled,
  className = '',
  onCommit,
  onKeyDown,
}: {
  value: string;
  label: string;
  disabled?: boolean;
  className?: string;
  onCommit: (value: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <input
      key={value}
      aria-label={label}
      defaultValue={value}
      disabled={disabled}
      className={`${cellInput} ${className}`}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (!e.defaultPrevented) blurOnEnterRevertOnEscape(e, value);
      }}
      onBlur={(e) => {
        const next = e.currentTarget.value.trim();
        if (!next) e.currentTarget.value = value;
        else if (next !== value) onCommit(next);
      }}
    />
  );
}

export function DateCell({
  value,
  label,
  disabled,
  onCommit,
}: {
  value: string;
  label: string;
  disabled?: boolean;
  onCommit: (value: string) => void;
}) {
  const commit = (next: string) => {
    // Typing a year digit by digit yields dates like 0002-…; wait for a plausible one.
    if (next !== value && isCalendarDate(next) && next >= '1900-01-01') onCommit(next);
  };
  return (
    <input
      key={value}
      type="date"
      aria-label={label}
      defaultValue={value}
      disabled={disabled}
      className={`${cellInput} tabular-nums`}
      onChange={(e) => commit(e.currentTarget.value)}
      onKeyDown={(e) => blurOnEnterRevertOnEscape(e, value)}
      onBlur={(e) => {
        if (!isCalendarDate(e.currentTarget.value)) e.currentTarget.value = value;
      }}
    />
  );
}

export function ProgressCell({
  value,
  label,
  disabled,
  onCommit,
}: {
  value: number;
  label: string;
  disabled?: boolean;
  onCommit: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-slate-200" aria-hidden>
        <div className="h-full bg-indigo-500" style={{ width: `${value}%` }} />
      </div>
      <input
        key={value}
        type="number"
        min={0}
        max={100}
        step={5}
        aria-label={label}
        defaultValue={value}
        disabled={disabled}
        className={`${cellInput} w-16 text-right tabular-nums`}
        onKeyDown={(e) => blurOnEnterRevertOnEscape(e, String(value))}
        onBlur={(e) => {
          const parsed = Math.round(Number(e.currentTarget.value));
          if (!Number.isFinite(parsed) || e.currentTarget.value === '') {
            e.currentTarget.value = String(value);
            return;
          }
          const clamped = Math.min(100, Math.max(0, parsed));
          e.currentTarget.value = String(clamped);
          if (clamped !== value) onCommit(clamped);
        }}
      />
      <span className="text-xs text-slate-400">%</span>
    </div>
  );
}
