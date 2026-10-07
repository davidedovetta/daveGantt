import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyServerOptions } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { registerAuth } from './auth/plugin.js';
import type { Db } from './db.js';
import { AppError, registerErrorHandling } from './errors.js';
import { authRoutes } from './routes/auth.js';
import { healthRoutes } from './routes/health.js';
import { workspaceRoutes } from './routes/workspaces.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    cookieSecure: boolean;
    authRateLimitMax: number;
  }
}

export interface AppOptions {
  db: Db;
  logger?: FastifyServerOptions['logger'];
  /** `Secure` flag on the session cookie. */
  cookieSecure?: boolean;
  /** Max login/register attempts per IP per minute. */
  authRateLimitMax?: number;
}

export async function buildApp({
  db,
  logger = false,
  cookieSecure = true,
  authRateLimitMax = 10,
}: AppOptions) {
  const app = Fastify({ logger }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.decorate('db', db);
  app.decorate('cookieSecure', cookieSecure);
  app.decorate('authRateLimitMax', authRateLimitMax);

  registerErrorHandling(app);
  await app.register(cookie);
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: () =>
      new AppError(429, 'RATE_LIMITED', 'Troppi tentativi, riprova tra un minuto'),
  });
  registerAuth(app);

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(workspaceRoutes);

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
