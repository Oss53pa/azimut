#!/usr/bin/env node

/**
 * Rolls back the most recently applied migration.
 * Usage: DATABASE_URL=... node scripts/rollback.js
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';

const url = process.env['DATABASE_URL'];
if (!url) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const migrationsDir = join(import.meta.dirname, '..', 'migrations');
const sql = postgres(url);

try {
  const exists = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_name = '_migrations'
    ) AS ok
  `;

  if (!exists[0]?.ok) {
    console.log('No migrations table found. Nothing to roll back.');
    process.exit(0);
  }

  const rows = await sql`
    SELECT name FROM _migrations ORDER BY id DESC LIMIT 1
  `;

  if (rows.length === 0) {
    console.log('No migrations to roll back.');
    process.exit(0);
  }

  const name = rows[0]?.name;
  if (!name) {
    console.log('No migrations to roll back.');
    process.exit(0);
  }

  const downFile = join(migrationsDir, `${name}.down.sql`);
  if (!existsSync(downFile)) {
    console.error(
      `No down migration found for ${name}. ` +
        'This migration is not reversible.',
    );
    process.exit(1);
  }

  const content = readFileSync(downFile, 'utf-8');
  await sql.begin(async (tx) => {
    await tx.unsafe(content);
    await tx`DELETE FROM _migrations WHERE name = ${name}`;
  });
  console.log(`Rolled back: ${name}`);
} finally {
  await sql.end();
}
