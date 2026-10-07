import type { FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';

export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const unauthorized = () => new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
export const forbidden = () => new AppError(403, 'FORBIDDEN', 'Permessi insufficienti');
export const notFound = (what: string) => new AppError(404, 'NOT_FOUND', `${what} non trovato`);

/** Every error leaves the API as `{ error: { code, message } }` (see `apiErrorSchema`). */
export function registerErrorHandling(app: FastifyInstance) {
  app.setErrorHandler((err, request, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send({ error: { code: err.code, message: err.message } });
    }
    if (hasZodFastifySchemaValidationErrors(err)) {
      const message = err.validation[0]?.message ?? 'Richiesta non valida';
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message } });
    }
    const { statusCode, message } = err as { statusCode?: number; message?: string };
    if (statusCode !== undefined && statusCode >= 400 && statusCode < 500) {
      return reply
        .code(statusCode)
        .send({ error: { code: 'BAD_REQUEST', message: message ?? 'Richiesta non valida' } });
    }
    request.log.error({ err }, 'unhandled error');
    return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Errore interno' } });
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Risorsa non trovata' } }),
  );
}
