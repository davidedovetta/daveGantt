import {
  apiErrorSchema,
  compareDates,
  createTaskInputSchema,
  moveTaskInputSchema,
  taskSchema,
  updateTaskInputSchema,
} from '@davegantt/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireUser } from '../auth/plugin.js';
import { requireProjectRole } from '../authz.js';
import { fromDbDate, toDbDate } from '../dates.js';
import { AppError, notFound } from '../errors.js';
import type { Db } from '../db.js';
import type { Task } from '../generated/prisma/client.js';
import { keyAfter } from '../sort-keys.js';

const projectParams = z.object({ projectId: z.uuid() });
const taskParams = z.object({ taskId: z.uuid() });

export const toTaskDto = (t: Task) => ({
  id: t.id,
  projectId: t.projectId,
  parentId: t.parentId,
  type: t.type,
  name: t.name,
  description: t.description,
  startDate: fromDbDate(t.startDate),
  endDate: fromDbDate(t.endDate),
  progress: t.progress,
  status: t.status,
  color: t.color,
  assigneeId: t.assigneeId,
  sortKey: t.sortKey,
  version: t.version,
});

const badRequest = (code: string, message: string) => new AppError(400, code, message);

/** Milestones are single-day; other tasks need `end >= start`. Returns the dates to store. */
function normalizeDates(type: Task['type'], startDate: string, endDate: string) {
  if (type === 'MILESTONE') return { startDate, endDate: startDate };
  if (compareDates(endDate, startDate) < 0) {
    throw badRequest('INVALID_DATES', 'La data di fine non può precedere la data di inizio');
  }
  return { startDate, endDate };
}

async function loadTask(db: Db, userId: string, taskId: string, minRole: 'VIEWER' | 'EDITOR') {
  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) throw notFound('Task');
  try {
    const { project } = await requireProjectRole(db, userId, task.projectId, minRole);
    return { task, project };
  } catch (err) {
    // Don't reveal that the task exists to people who cannot see its project.
    if (err instanceof AppError && err.statusCode === 404) throw notFound('Task');
    throw err;
  }
}

async function siblingKeys(db: Db, projectId: string, parentId: string | null, excludeId?: string) {
  const siblings = await db.task.findMany({
    where: { projectId, parentId, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true, sortKey: true },
  });
  return siblings;
}

async function assertParentInProject(db: Db, projectId: string, parentId: string | null) {
  if (parentId === null) return;
  const parent = await db.task.findFirst({
    where: { id: parentId, projectId },
    select: { id: true },
  });
  if (!parent) throw badRequest('INVALID_PARENT', 'Il task padre non appartiene al progetto');
}

function resolveAfterKey(
  siblings: { id: string; sortKey: string }[],
  afterId: string | null | undefined,
): string | null | undefined {
  if (afterId === undefined || afterId === null) return afterId;
  const after = siblings.find((s) => s.id === afterId);
  if (!after) throw badRequest('INVALID_POSITION', 'Posizione non valida');
  return after.sortKey;
}

const versionConflict = () =>
  new AppError(409, 'VERSION_CONFLICT', 'Il task è stato modificato da un altro utente');

export const taskRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/projects/:projectId/tasks',
    {
      schema: {
        params: projectParams,
        body: createTaskInputSchema,
        response: { 201: taskSchema, 400: apiErrorSchema },
      },
    },
    async (request, reply) => {
      const user = requireUser(request);
      const { project } = await requireProjectRole(
        app.db,
        user.id,
        request.params.projectId,
        'EDITOR',
      );
      const { name, type, parentId, afterId } = request.body;
      const dates = normalizeDates(type, request.body.startDate, request.body.endDate);
      await assertParentInProject(app.db, project.id, parentId);

      const siblings = await siblingKeys(app.db, project.id, parentId);
      const sortKey = keyAfter(
        siblings.map((s) => s.sortKey),
        resolveAfterKey(siblings, afterId),
      );

      const task = await app.db.task.create({
        data: {
          projectId: project.id,
          parentId,
          type,
          name,
          startDate: toDbDate(dates.startDate),
          endDate: toDbDate(dates.endDate),
          sortKey,
          createdById: user.id,
        },
      });
      return reply.code(201).send(toTaskDto(task));
    },
  );

  app.patch(
    '/tasks/:taskId',
    {
      schema: {
        params: taskParams,
        body: updateTaskInputSchema,
        response: { 200: taskSchema, 400: apiErrorSchema, 409: apiErrorSchema },
      },
    },
    async (request) => {
      const user = requireUser(request);
      const { task, project } = await loadTask(app.db, user.id, request.params.taskId, 'EDITOR');
      const { version, ...changes } = request.body;
      if (task.version !== version) throw versionConflict();

      const touchesRolledUp =
        changes.startDate !== undefined ||
        changes.endDate !== undefined ||
        changes.progress !== undefined;
      if (touchesRolledUp && (await app.db.task.count({ where: { parentId: task.id } })) > 0) {
        throw badRequest(
          'SUMMARY_READ_ONLY',
          'Date e avanzamento di un task con sottotask sono calcolati dai sottotask',
        );
      }

      const type = changes.type ?? task.type;
      const dates = normalizeDates(
        type,
        changes.startDate ?? fromDbDate(task.startDate),
        changes.endDate ?? fromDbDate(task.endDate),
      );

      if (changes.assigneeId) {
        const member = await app.db.workspaceMember.findUnique({
          where: {
            workspaceId_userId: { workspaceId: project.workspaceId, userId: changes.assigneeId },
          },
          select: { userId: true },
        });
        if (!member) {
          throw badRequest(
            'INVALID_ASSIGNEE',
            "L'assegnatario deve essere un membro del workspace",
          );
        }
      }

      // Conditional on the version, so two concurrent updates cannot both succeed.
      const { count } = await app.db.task.updateMany({
        where: { id: task.id, version },
        data: {
          ...changes,
          type,
          startDate: toDbDate(dates.startDate),
          endDate: toDbDate(dates.endDate),
          version: { increment: 1 },
        },
      });
      if (count === 0) throw versionConflict();
      return toTaskDto(await app.db.task.findUniqueOrThrow({ where: { id: task.id } }));
    },
  );

  app.delete(
    '/tasks/:taskId',
    { schema: { params: taskParams, response: { 204: z.null() } } },
    async (request, reply) => {
      const user = requireUser(request);
      const { task } = await loadTask(app.db, user.id, request.params.taskId, 'EDITOR');
      // Subtasks go with it (ON DELETE CASCADE on parentId).
      await app.db.task.deleteMany({ where: { id: task.id } });
      return reply.code(204).send(null);
    },
  );

  app.post(
    '/tasks/:taskId/move',
    {
      schema: {
        params: taskParams,
        body: moveTaskInputSchema,
        response: { 200: taskSchema, 400: apiErrorSchema },
      },
    },
    async (request) => {
      const user = requireUser(request);
      const { task, project } = await loadTask(app.db, user.id, request.params.taskId, 'EDITOR');
      const { parentId, afterId } = request.body;

      if (parentId !== null) {
        await assertParentInProject(app.db, project.id, parentId);
        // Walk up from the new parent: reaching the task means it would become its own ancestor.
        let cursor: string | null = parentId;
        while (cursor !== null) {
          if (cursor === task.id) {
            throw badRequest(
              'INVALID_PARENT',
              'Un task non può diventare figlio di un suo sottotask',
            );
          }
          const next: { parentId: string | null } | null = await app.db.task.findUnique({
            where: { id: cursor },
            select: { parentId: true },
          });
          cursor = next?.parentId ?? null;
        }
      }

      const siblings = await siblingKeys(app.db, project.id, parentId, task.id);
      const sortKey = keyAfter(
        siblings.map((s) => s.sortKey),
        resolveAfterKey(siblings, afterId),
      );
      const moved = await app.db.task.update({
        where: { id: task.id },
        data: { parentId, sortKey, version: { increment: 1 } },
      });
      return toTaskDto(moved);
    },
  );
};
