import {
  createWorkspaceInputSchema,
  workspaceListSchema,
  workspaceSchema,
} from '@davegantt/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireUser } from '../auth/plugin.js';

export const workspaceRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/workspaces',
    { schema: { response: { 200: workspaceListSchema } } },
    async (request) => {
      const user = requireUser(request);
      const memberships = await app.db.workspaceMember.findMany({
        where: { userId: user.id },
        select: { role: true, workspace: { select: { id: true, name: true } } },
        orderBy: { workspace: { createdAt: 'asc' } },
      });
      return memberships.map((m) => ({ id: m.workspace.id, name: m.workspace.name, role: m.role }));
    },
  );

  app.post(
    '/workspaces',
    { schema: { body: createWorkspaceInputSchema, response: { 201: workspaceSchema } } },
    async (request, reply) => {
      const user = requireUser(request);
      const workspace = await app.db.workspace.create({
        data: { name: request.body.name, members: { create: { userId: user.id, role: 'OWNER' } } },
        select: { id: true, name: true },
      });
      return reply.code(201).send({ ...workspace, role: 'OWNER' as const });
    },
  );
};
