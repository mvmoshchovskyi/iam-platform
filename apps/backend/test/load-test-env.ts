import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'dotenv';

/** Loads apps/backend/.env.test into process.env (explicit env vars win, e.g. in CI). */
export function loadTestEnv(): void {
  const parsed = parse(readFileSync(join(__dirname, '..', '.env.test')));
  for (const [key, value] of Object.entries(parsed)) process.env[key] ??= value;
  process.env.NODE_ENV = 'test';
}
