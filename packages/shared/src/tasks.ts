import { z } from 'zod';
import { calendarDateSchema } from './dates.js';
import { projectSchema } from './projects.js';
import { roleSchema } from './workspaces.js';

export const taskTypeSchema = z.enum(['TASK', 'MILESTONE']);
export const taskStatusSchema = z.enum(['TODO', 'IN_PROGRESS', 'DONE']);

export const taskSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  parentId: z.uuid().nullable(),
  type: taskTypeSchema,
  name: z.string(),
  description: z.string(),
  startDate: calendarDateSchema,
  endDate: calendarDateSchema,
  progress: z.number().int().min(0).max(100),
  status: taskStatusSchema,
  color: z.string().nullable(),
  assigneeId: z.uuid().nullable(),
  sortKey: z.string(),
  version: z.number().int(),
});

export const projectDetailSchema = z.object({
  project: projectSchema,
  role: roleSchema,
  tasks: z.array(taskSchema),
});

const taskName = z.string().trim().min(1, 'Il nome è obbligatorio').max(500);

export const createTaskInputSchema = z.object({
  name: taskName,
  type: taskTypeSchema.default('TASK'),
  startDate: calendarDateSchema,
  endDate: calendarDateSchema,
  parentId: z.uuid().nullable().default(null),
  /** Insert right after this sibling; omitted = last among siblings. */
  afterId: z.uuid().nullable().optional(),
});

export const updateTaskInputSchema = z.object({
  version: z.number().int(),
  name: taskName.optional(),
  description: z.string().max(10_000).optional(),
  type: taskTypeSchema.optional(),
  startDate: calendarDateSchema.optional(),
  endDate: calendarDateSchema.optional(),
  progress: z.number().int().min(0).max(100).optional(),
  status: taskStatusSchema.optional(),
  assigneeId: z.uuid().nullable().optional(),
});

export const moveTaskInputSchema = z.object({
  parentId: z.uuid().nullable(),
  /** Place right after this sibling of the new parent; `null` = first child. */
  afterId: z.uuid().nullable(),
});

export type TaskType = z.infer<typeof taskTypeSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type Task = z.infer<typeof taskSchema>;
export type ProjectDetail = z.infer<typeof projectDetailSchema>;
export type CreateTaskInput = z.input<typeof createTaskInputSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskInputSchema>;
