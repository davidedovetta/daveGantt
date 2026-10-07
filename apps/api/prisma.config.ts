import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Prisma 7 does not load .env on its own. Variables already set in the
// environment win, so tests can point DATABASE_URL at the test database.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
