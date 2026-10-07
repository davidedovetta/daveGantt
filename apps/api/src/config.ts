import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.url(),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  // Defaults to true in production. Safari rejects Secure cookies on http://localhost.
  COOKIE_SECURE: z.stringbool().optional(),
  // Set to true behind a reverse proxy so request.ip (used by rate limiting) is the client IP.
  TRUST_PROXY: z.stringbool().default(false),
});

export type Config = z.infer<typeof configSchema> & { cookieSecure: boolean };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  const data = result.data;
  return { ...data, cookieSecure: data.COOKIE_SECURE ?? data.NODE_ENV === 'production' };
}
