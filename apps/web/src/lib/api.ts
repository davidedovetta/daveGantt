import { apiErrorSchema, CSRF_HEADER, CSRF_HEADER_VALUE } from '@davegantt/shared';
import type { z } from 'zod';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Calls `/api${path}`. Non-2xx responses throw `ApiError` carrying the server error code and
 * message; 2xx bodies are validated against `schema` (omit it for empty responses).
 */
export async function apiRequest<T extends z.ZodType>(
  method: Method,
  path: string,
  options: { body?: unknown; schema: T },
): Promise<z.infer<T>>;
export async function apiRequest(
  method: Method,
  path: string,
  options?: { body?: unknown },
): Promise<void>;
export async function apiRequest(
  method: Method,
  path: string,
  { body, schema }: { body?: unknown; schema?: z.ZodType } = {},
): Promise<unknown> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (method !== 'GET') headers[CSRF_HEADER] = CSRF_HEADER_VALUE;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(await res.json().catch(() => undefined));
    throw parsed.success
      ? new ApiError(res.status, parsed.data.error.code, parsed.data.error.message)
      : new ApiError(res.status, 'UNKNOWN', `Richiesta fallita (${res.status})`);
  }
  if (!schema) return undefined;
  return schema.parse(await res.json());
}

export const isUnauthorized = (err: unknown) => err instanceof ApiError && err.status === 401;

export const errorMessage = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Si è verificato un errore imprevisto';
