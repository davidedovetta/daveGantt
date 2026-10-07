import type { z } from 'zod';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** GETs `/api${path}` and validates the JSON body against `schema`. Non-2xx responses throw `ApiError`. */
export async function getJson<T extends z.ZodType>(path: string, schema: T): Promise<z.infer<T>> {
  const res = await fetch(`/api${path}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new ApiError(res.status, `Richiesta fallita (${res.status})`);
  return schema.parse(await res.json());
}
