import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyServerOptions } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { registerAuth } from './auth/plugin.js';
import type { Db } from './db.js';
import { AppError, registerErrorHandling, sendNotFound } from './errors.js';
import { authRoutes } from './routes/auth.js';
import { healthRoutes } from './routes/health.js';
import { memberRoutes } from './routes/members.js';
import { projectRoutes } from './routes/projects.js';
import { taskRoutes } from './routes/tasks.js';
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
  /** Trust `X-Forwarded-*` headers (only behind a reverse proxy). */
  trustProxy?: boolean;
  /** Prefix of every API route (`/api` when served together with the web app). */
  apiPrefix?: string;
  /** Built web app to serve on the same origin (production); omitted in dev and tests. */
  webDistDir?: string;
}

export async function buildApp({
  db,
  logger = false,
  cookieSecure = true,
  authRateLimitMax = 10,
  trustProxy = false,
  apiPrefix = '',
  webDistDir,
}: AppOptions) {
  const app = Fastify({ logger, trustProxy }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.decorate('db', db);
  app.decorate('cookieSecure', cookieSecure);
  app.decorate('authRateLimitMax', authRateLimitMax);

  registerErrorHandling(app);
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        // React sets inline style attributes (bar positions, colors).
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        // Would break plain-http local runs of the production build.
        upgradeInsecureRequests: cookieSecure ? [] : null,
      },
    },
  });
  await app.register(cookie);
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: () =>
      new AppError(429, 'RATE_LIMITED', 'Troppi tentativi, riprova tra un minuto'),
  });
  registerAuth(app);

  await app.register(
    async (api) => {
      await api.register(healthRoutes);
      await api.register(authRoutes);
      await api.register(workspaceRoutes);
      await api.register(memberRoutes);
      await api.register(projectRoutes);
      await api.register(taskRoutes);
    },
    { prefix: apiPrefix },
  );

  if (webDistDir) {
    await app.register(fastifyStatic, {
      root: webDistDir,
      wildcard: false,
      setHeaders: (res, filePath) => {
        // Vite fingerprints everything under assets/, so it can be cached forever.
        res.header(
          'cache-control',
          filePath.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
        );
      },
    });
  }

  // Unknown GET pages fall back to the SPA (client-side routes like /p/:id); the rest is JSON.
  app.setNotFoundHandler((request, reply) => {
    const isApi = apiPrefix !== '' && request.url.startsWith(`${apiPrefix}/`);
    if (webDistDir && request.method === 'GET' && !isApi) {
      return reply.header('cache-control', 'no-cache').sendFile('index.html');
    }
    return sendNotFound(reply);
  });

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
