import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createDb } from '../src/db.js';

export async function buildTestApp() {
  const db = createDb(loadConfig().DATABASE_URL);
  const app = await buildApp({ db });
  app.addHook('onClose', async () => {
    await db.$disconnect();
  });
  return app;
}
