import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { loadTestEnv } from './load-test-env';

/**
 * Prepares the dedicated test database (docker-compose.test.yml, port 5433, tmpfs storage):
 * applies migrations and runs the idempotent seed. Nothing is deleted — tests use unique
 * emails, and the database disappears with its container. Refuses non-*_test databases.
 */
export default function globalSetup(): void {
  loadTestEnv();
  const url = process.env.DATABASE_URL ?? '';
  if (!/\/\w+_test(\?|$)/.test(url)) {
    throw new Error(`Refusing to prepare non-test database: ${url}`);
  }
  const opts = {
    cwd: join(__dirname, '..'),
    env: process.env,
    stdio: ['ignore', 'ignore', 'inherit'] as ('ignore' | 'inherit')[],
  };
  execSync('npx prisma migrate deploy', opts);
  execSync('npx prisma db seed', opts);
}
