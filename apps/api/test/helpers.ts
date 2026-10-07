import { CSRF_HEADER, CSRF_HEADER_VALUE } from '@davegantt/shared';
import { buildApp, type App, type AppOptions } from '../src/app.js';
import { SESSION_COOKIE } from '../src/auth/sessions.js';
import { loadConfig } from '../src/config.js';
import { createDb, type Db } from '../src/db.js';

export const csrfHeaders = { [CSRF_HEADER]: CSRF_HEADER_VALUE };

export async function buildTestApp(options: Omit<AppOptions, 'db'> = {}) {
  const db = createDb(loadConfig().DATABASE_URL);
  const app = await buildApp({ db, authRateLimitMax: 1000, ...options });
  app.addHook('onClose', async () => {
    await db.$disconnect();
  });
  return app;
}

/** Empties every application table. Refuses to run outside a `*_test` database. */
export async function resetDb(db: Db) {
  const [{ name }] = await db.$queryRaw<[{ name: string }]>`SELECT current_database() AS name`;
  if (!name.endsWith('_test')) throw new Error(`resetDb refused on database "${name}"`);
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
}

let userCounter = 0;

/** Registers a fresh user and returns it with the cookies to authenticate as them. */
export async function registerUser(app: App, overrides: { email?: string; name?: string } = {}) {
  userCounter += 1;
  const payload = {
    email: overrides.email ?? `user${userCounter}@example.com`,
    name: overrides.name ?? `User ${userCounter}`,
    password: 'correct-horse-battery',
  };
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    headers: csrfHeaders,
    payload,
  });
  if (res.statusCode !== 201) throw new Error(`register failed: ${res.statusCode} ${res.body}`);
  const token = res.cookies.find((c) => c.name === SESSION_COOKIE)?.value;
  if (!token) throw new Error('register did not set the session cookie');
  const { user } = res.json() as { user: { id: string; email: string; name: string } };
  return { user, password: payload.password, cookies: { [SESSION_COOKIE]: token } };
}
