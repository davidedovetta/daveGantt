import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

if (existsSync('.env')) process.loadEnvFile('.env');

const testDatabaseUrl = process.env['TEST_DATABASE_URL'];
if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is not set (see apps/api/.env.example)');

export default defineConfig({
  test: {
    env: { NODE_ENV: 'test', DATABASE_URL: testDatabaseUrl },
    globalSetup: ['test/global-setup.ts'],
    // Integration tests share one database: run files sequentially.
    fileParallelism: false,
  },
});
