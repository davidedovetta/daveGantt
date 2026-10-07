import {
  addMemberInputSchema,
  apiErrorSchema,
  memberListSchema,
  memberSchema,
  updateMemberInputSchema,
} from '@davegantt/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireUser } from '../auth/plugin.js';
import { requireWorkspaceRole } from '../authz.js';
import { AppError, forbidden, notFound } from '../errors.js';
import { Prisma } from '../generated/prisma/client.js';

const workspaceParams = z.object({ workspaceId: z.uuid() });
const memberParams = workspaceParams.extend({ userId: z.uuid() });

const memberSelect = {
  role: true,
  user: { select: { id: true, name: true, email: true } },
} as const;

type MemberRow = Prisma.WorkspaceMemberGetPayload<{ select: typeof memberSelect }>;

const toMember = ({ role, user }: MemberRow) => ({
  userId: user.id,
  name: user.name,
  email: user.email,
  role,
});

const lastOwner = () =>
  new AppError(409, 'LAST_OWNER', 'Il workspace deve avere almeno un proprietario');

/**
 * Serializes membership changes of one workspace, so concurrent demotions/removals cannot
 * leave it without an OWNER.
 */
async function lockWorkspace(tx: Prisma.TransactionClient, workspaceId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Workspace" WHERE id = ${workspaceId}::uuid FOR UPDATE`;
  if (rows.length === 0) throw notFound('Workspace');
}

async function assertHasOwner(tx: Prisma.TransactionClient, workspaceId: string) {
  const owners = await tx.workspaceMember.count({ where: { workspaceId, role: 'OWNER' } });
  if (owners === 0) throw lastOwner();
}

export const memberRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/workspaces/:workspaceId/members',
    { schema: { params: workspaceParams, response: { 200: memberListSchema } } },
    async (request) => {
      const user = requireUser(request);
      const { workspaceId } = request.params;
      await requireWorkspaceRole(app.db, user.id, workspaceId, 'VIEWER');
      const rows = await app.db.workspaceMember.findMany({
        where: { workspaceId },
        select: memberSelect,
        orderBy: { createdAt: 'asc' },
      });
      return rows.map(toMember);
    },
  );

  app.post(
    '/workspaces/:workspaceId/members',
    {
      schema: {
        params: workspaceParams,
        body: addMemberInputSchema,
        response: { 201: memberSchema, 404: apiErrorSchema, 409: apiErrorSchema },
      },
    },
    async (request, reply) => {
      const user = requireUser(request);
      const { workspaceId } = request.params;
      await requireWorkspaceRole(app.db, user.id, workspaceId, 'OWNER');

      const invitee = await app.db.user.findUnique({
        where: { email: request.body.email },
        select: { id: true },
      });
      if (!invitee) {
        throw new AppError(404, 'USER_NOT_FOUND', 'Nessun utente registrato con questa email');
      }

      try {
        const row = await app.db.workspaceMember.create({
          data: { workspaceId, userId: invitee.id, role: request.body.role },
          select: memberSelect,
        });
        return reply.code(201).send(toMember(row));
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new AppError(409, 'ALREADY_MEMBER', 'Questo utente è già membro del workspace');
        }
        throw err;
      }
    },
  );

  app.patch(
    '/workspaces/:workspaceId/members/:userId',
    {
      schema: {
        params: memberParams,
        body: updateMemberInputSchema,
        response: { 200: memberSchema, 409: apiErrorSchema },
      },
    },
    async (request) => {
      const user = requireUser(request);
      const { workspaceId, userId } = request.params;

      const row = await app.db.$transaction(async (tx) => {
        await lockWorkspace(tx, workspaceId);
        await requireWorkspaceRole(tx, user.id, workspaceId, 'OWNER');
        const key = { workspaceId_userId: { workspaceId, userId } };
        if (!(await tx.workspaceMember.findUnique({ where: key, select: { role: true } }))) {
          throw notFound('Membro');
        }
        const updated = await tx.workspaceMember.update({
          where: key,
          data: { role: request.body.role },
          select: memberSelect,
        });
        await assertHasOwner(tx, workspaceId);
        return updated;
      });
      return toMember(row);
    },
  );

  // OWNERs can remove anyone; every member can remove themselves (leave the workspace).
  app.delete(
    '/workspaces/:workspaceId/members/:userId',
    { schema: { params: memberParams, response: { 204: z.null(), 409: apiErrorSchema } } },
    async (request, reply) => {
      const user = requireUser(request);
      const { workspaceId, userId } = request.params;

      await app.db.$transaction(async (tx) => {
        await lockWorkspace(tx, workspaceId);
        const callerRole = await requireWorkspaceRole(tx, user.id, workspaceId, 'VIEWER');
        if (userId !== user.id && callerRole !== 'OWNER') throw forbidden();
        const { count } = await tx.workspaceMember.deleteMany({ where: { workspaceId, userId } });
        if (count === 0) throw notFound('Membro');
        await assertHasOwner(tx, workspaceId);
      });
      return reply.code(204).send(null);
    },
  );
};
