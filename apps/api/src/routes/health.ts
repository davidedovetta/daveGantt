import { healthResponseSchema } from '@davegantt/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/health',
    { schema: { response: { 200: healthResponseSchema, 503: healthResponseSchema } } },
    async (request, reply) => {
      try {
        await app.db.$queryRaw`SELECT 1`;
        return { status: 'ok' as const, database: 'up' as const };
      } catch (err) {
        request.log.error({ err }, 'database health check failed');
        return reply.code(503).send({ status: 'degraded', database: 'down' });
      }
    },
  );
};
