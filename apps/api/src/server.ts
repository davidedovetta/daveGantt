import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db.js';

const config = loadConfig();
const db = createDb(config.DATABASE_URL);

const app = await buildApp({
  db,
  cookieSecure: config.cookieSecure,
  trustProxy: config.TRUST_PROXY,
  logger:
    config.NODE_ENV === 'development'
      ? { level: config.LOG_LEVEL, transport: { target: 'pino-pretty' } }
      : { level: config.LOG_LEVEL },
});

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  await db.$disconnect();
  process.exit(0);
};
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

await app.listen({ host: config.HOST, port: config.PORT });
