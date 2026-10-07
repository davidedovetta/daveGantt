import {
  createProjectInputSchema,
  PROJECT_COLORS,
  projectDetailSchema,
  projectListSchema,
  projectSchema,
  updateProjectInputSchema,
} from '@davegantt/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireUser } from '../auth/plugin.js';
import { requireProjectRole, requireWorkspaceRole } from '../authz.js';
import type { Project } from '../generated/prisma/client.js';
import { compareKeys } from '../sort-keys.js';
import { toTaskDto } from './tasks.js';

const workspaceParams = z.object({ workspaceId: z.uuid() });
const projectParams = z.object({ projectId: z.uuid() });

export const toProjectDto = (p: Project) => ({
  id: p.id,
  workspaceId: p.workspaceId,
  name: p.name,
  color: p.color,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
});

export const projectRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/workspaces/:workspaceId/projects',
    { schema: { params: workspaceParams, response: { 200: projectListSchema } } },
    async (request) => {
      const user = requireUser(request);
      const { workspaceId } = request.params;
      await requireWorkspaceRole(app.db, user.id, workspaceId, 'VIEWER');
      const projects = await app.db.project.findMany({
        where: { workspaceId, archivedAt: null },
        orderBy: { createdAt: 'asc' },
      });
      return projects.map(toProjectDto);
    },
  );

  app.post(
    '/workspaces/:workspaceId/projects',
    {
      schema: {
        params: workspaceParams,
        body: createProjectInputSchema,
        response: { 201: projectSchema },
      },
    },
    async (request, reply) => {
      const user = requireUser(request);
      const { workspaceId } = request.params;
      await requireWorkspaceRole(app.db, user.id, workspaceId, 'EDITOR');
      const count = await app.db.project.count({ where: { workspaceId } });
      const project = await app.db.project.create({
        data: {
          workspaceId,
          name: request.body.name,
          color: request.body.color ?? PROJECT_COLORS[count % PROJECT_COLORS.length]!,
        },
      });
      return reply.code(201).send(toProjectDto(project));
    },
  );

  app.get(
    '/projects/:projectId',
    { schema: { params: projectParams, response: { 200: projectDetailSchema } } },
    async (request) => {
      const user = requireUser(request);
      const { project, role } = await requireProjectRole(
        app.db,
        user.id,
        request.params.projectId,
        'VIEWER',
      );
      const tasks = await app.db.task.findMany({ where: { projectId: project.id } });
      tasks.sort((a, b) => compareKeys(a.sortKey, b.sortKey));
      return { project: toProjectDto(project), role, tasks: tasks.map(toTaskDto) };
    },
  );

  app.patch(
    '/projects/:projectId',
    {
      schema: {
        params: projectParams,
        body: updateProjectInputSchema,
        response: { 200: projectSchema },
      },
    },
    async (request) => {
      const user = requireUser(request);
      const { project } = await requireProjectRole(
        app.db,
        user.id,
        request.params.projectId,
        'EDITOR',
      );
      const updated = await app.db.project.update({
        where: { id: project.id },
        data: request.body,
      });
      return toProjectDto(updated);
    },
  );

  // Archives (soft delete): archived projects disappear from every endpoint.
  app.delete(
    '/projects/:projectId',
    { schema: { params: projectParams, response: { 204: z.null() } } },
    async (request, reply) => {
      const user = requireUser(request);
      const { project } = await requireProjectRole(
        app.db,
        user.id,
        request.params.projectId,
        'EDITOR',
      );
      await app.db.project.update({ where: { id: project.id }, data: { archivedAt: new Date() } });
      return reply.code(204).send(null);
    },
  );
};
