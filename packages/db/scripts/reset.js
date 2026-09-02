#!/usr/bin/env node

/**
 * Drops the public schema, recreates it, and runs all migrations.
 * Produces an identical empty database from any state.
 * Usage: DATABASE_URL=... node scripts/reset.js
 */

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import postgres from 'postgres';

const url = process.env['DATABASE_URL'];
if (!url) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const sql = postgres(url);

try {
  await sql.unsafe('DROP SCHEMA public CASCADE');
  await sql.unsafe('CREATE SCHEMA public');
  await sql.unsafe('GRANT ALL ON SCHEMA public TO PUBLIC');
  console.log('Schema reset.');
} finally {
  await sql.end();
}

const migrateScript = join(import.meta.dirname, 'migrate.js');
execFileSync('node', [migrateScript], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: url },
});
