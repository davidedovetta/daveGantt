import { z } from 'zod';

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

/** Header every mutating request must carry (CSRF defence together with SameSite cookies). */
export const CSRF_HEADER = 'x-requested-with';
export const CSRF_HEADER_VALUE = 'davegantt';
