import Fastify, { type FastifyServerOptions } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { Db } from './db.js';
import { healthRoutes } from './routes/health.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
  }
}

export interface AppOptions {
  db: Db;
  logger?: FastifyServerOptions['logger'];
}

export async function buildApp({ db, logger = false }: AppOptions) {
  const app = Fastify({ logger }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.decorate('db', db);

  await app.register(healthRoutes);

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
