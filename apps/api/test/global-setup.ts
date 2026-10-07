import { execFileSync } from 'node:child_process';

// Applies pending migrations to the test database before the run.
// Refuses to touch anything that is not clearly a test database.
export default function setup() {
  const databaseUrl = process.env['TEST_DATABASE_URL'];
  if (!databaseUrl) throw new Error('TEST_DATABASE_URL is not set');
  if (!new URL(databaseUrl).pathname.endsWith('_test')) {
    throw new Error(`TEST_DATABASE_URL must point to a database whose name ends with "_test"`);
  }
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });
}
