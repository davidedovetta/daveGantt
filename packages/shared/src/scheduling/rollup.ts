import { maxDate, minDate, workingDaysBetween, type CalendarDate } from '../dates.js';

export interface RollupInput {
  id: string;
  parentId: string | null;
  type: 'TASK' | 'MILESTONE';
  startDate: CalendarDate;
  endDate: CalendarDate;
  progress: number;
}

export interface RolledUp {
  startDate: CalendarDate;
  endDate: CalendarDate;
  progress: number;
  isSummary: boolean;
}

/**
 * Effective dates and progress of every task. Summaries (tasks with children) span their
 * descendants and take a progress weighted by working-day duration (milestones weigh 0;
 * if every leaf weighs 0 the plain average is used). Leaves keep their own values.
 */
export function rollup(tasks: readonly RollupInput[]): Map<string, RolledUp> {
  const children = new Map<string, RollupInput[]>();
  for (const t of tasks) {
    if (t.parentId === null) continue;
    const list = children.get(t.parentId);
    if (list) list.push(t);
    else children.set(t.parentId, [t]);
  }

  const result = new Map<string, RolledUp>();
  // Weighted progress needs totals, not averages, to combine correctly across levels.
  const totals = new Map<string, { weight: number; done: number; count: number; sum: number }>();

  const visit = (task: RollupInput, depth: number): void => {
    if (result.has(task.id)) return;
    if (depth > tasks.length) throw new Error('Task hierarchy contains a cycle');

    const kids = children.get(task.id);
    if (!kids || kids.length === 0) {
      const weight =
        task.type === 'MILESTONE' ? 0 : workingDaysBetween(task.startDate, task.endDate);
      result.set(task.id, { ...pick(task), isSummary: false });
      totals.set(task.id, {
        weight,
        done: (weight * task.progress) / 100,
        count: 1,
        sum: task.progress,
      });
      return;
    }

    let start: CalendarDate | undefined;
    let end: CalendarDate | undefined;
    const acc = { weight: 0, done: 0, count: 0, sum: 0 };
    for (const kid of kids) {
      visit(kid, depth + 1);
      const r = result.get(kid.id)!;
      const t = totals.get(kid.id)!;
      start = start === undefined ? r.startDate : minDate(start, r.startDate);
      end = end === undefined ? r.endDate : maxDate(end, r.endDate);
      acc.weight += t.weight;
      acc.done += t.done;
      acc.count += t.count;
      acc.sum += t.sum;
    }
    const progress = acc.weight > 0 ? (acc.done / acc.weight) * 100 : acc.sum / acc.count;
    result.set(task.id, {
      startDate: start!,
      endDate: end!,
      progress: Math.round(progress),
      isSummary: true,
    });
    totals.set(task.id, acc);
  };

  for (const t of tasks) visit(t, 0);
  return result;
}

const pick = ({ startDate, endDate, progress }: RollupInput) => ({ startDate, endDate, progress });
