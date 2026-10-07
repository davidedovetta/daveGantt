import {
  apiErrorSchema,
  loginInputSchema,
  meResponseSchema,
  registerInputSchema,
} from '@davegantt/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { hashPassword, verifyAgainstDummy, verifyPassword } from '../auth/password.js';
import { clearSessionCookie, requireUser, setSessionCookie } from '../auth/plugin.js';
import { createSession, deleteSession, SESSION_COOKIE } from '../auth/sessions.js';
import { AppError } from '../errors.js';
import { Prisma } from '../generated/prisma/client.js';

const userSelect = { id: true, email: true, name: true } as const;

const emailTaken = () => new AppError(409, 'EMAIL_TAKEN', 'Esiste già un account con questa email');

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  const rateLimit = { max: app.authRateLimitMax, timeWindow: '1 minute' };

  app.post(
    '/auth/register',
    {
      config: { rateLimit },
      schema: {
        body: registerInputSchema,
        response: { 201: meResponseSchema, 409: apiErrorSchema },
      },
    },
    async (request, reply) => {
      const { email, name, password } = request.body;
      const existing = await app.db.user.findUnique({ where: { email }, select: { id: true } });
      if (existing) throw emailTaken();

      const passwordHash = await hashPassword(password);
      let user;
      try {
        user = await app.db.user.create({
          data: {
            email,
            name,
            passwordHash,
            memberships: {
              create: { role: 'OWNER', workspace: { create: { name: `Workspace di ${name}` } } },
            },
          },
          select: userSelect,
        });
      } catch (err) {
        // Concurrent registration with the same email.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw emailTaken();
        }
        throw err;
      }

      const session = await createSession(app.db, user.id);
      setSessionCookie(app, reply, session.token, session.expiresAt);
      return reply.code(201).send({ user });
    },
  );

  app.post(
    '/auth/login',
    {
      config: { rateLimit },
      schema: {
        body: loginInputSchema,
        response: { 200: meResponseSchema, 401: apiErrorSchema },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;
      const found = await app.db.user.findUnique({
        where: { email },
        select: { ...userSelect, passwordHash: true },
      });

      const valid = found
        ? await verifyPassword(found.passwordHash, password)
        : (await verifyAgainstDummy(password), false);
      if (!found || !valid) {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Email o password non corretti');
      }

      const session = await createSession(app.db, found.id);
      setSessionCookie(app, reply, session.token, session.expiresAt);
      return { user: { id: found.id, email: found.email, name: found.name } };
    },
  );

  app.post('/auth/logout', { schema: { response: { 204: z.null() } } }, async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) await deleteSession(app.db, token);
    clearSessionCookie(app, reply);
    return reply.code(204).send(null);
  });

  app.get(
    '/auth/me',
    { schema: { response: { 200: meResponseSchema, 401: apiErrorSchema } } },
    async (request) => ({ user: requireUser(request) }),
  );
};
