import { CSRF_HEADER, CSRF_HEADER_VALUE, type User } from '@davegantt/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AppError, unauthorized } from '../errors.js';
import { resolveSession, SESSION_COOKIE } from './sessions.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: User | null;
  }
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function setSessionCookie(
  app: FastifyInstance,
  reply: FastifyReply,
  token: string,
  expires: Date,
) {
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: app.cookieSecure,
    expires,
  });
}

export function clearSessionCookie(app: FastifyInstance, reply: FastifyReply) {
  reply.clearCookie(SESSION_COOKIE, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: app.cookieSecure,
  });
}

/** CSRF header check on mutating requests, then resolves the session cookie into `request.user`. */
export function registerAuth(app: FastifyInstance) {
  app.decorateRequest('user', null);

  app.addHook('onRequest', async (request, reply) => {
    if (
      MUTATING_METHODS.has(request.method) &&
      request.headers[CSRF_HEADER] !== CSRF_HEADER_VALUE
    ) {
      throw new AppError(403, 'CSRF_REJECTED', 'Richiesta rifiutata');
    }

    const token = request.cookies[SESSION_COOKIE];
    if (!token) return;
    const session = await resolveSession(app.db, token);
    if (!session) {
      clearSessionCookie(app, reply);
      return;
    }
    request.user = session.user;
    if (session.renewedUntil) setSessionCookie(app, reply, token, session.renewedUntil);
  });
}

export function requireUser(request: FastifyRequest): User {
  if (!request.user) throw unauthorized();
  return request.user;
}
