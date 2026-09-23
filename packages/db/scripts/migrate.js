#!/usr/bin/env node

/**
 * Runs all pending up migrations in order.
 * Usage: DATABASE_URL=... node scripts/migrate.js
 */

import { readFileSync, readdirSync } from 'node:fs';
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
  // Le nom est qualifié. Sans schéma, il se résout par le chemin de recherche,
  // qui commence par `"$user"` : sous un rôle nommé `azimut` le registre
  // atterrissait dans le schéma de l'application, sous tout autre rôle dans le
  // schéma par défaut. Deux registres coexistaient, et un montage sous le
  // mauvais rôle rejouait toutes les migrations.
  // Créé seulement s'il manque, plutôt que `IF NOT EXISTS` : la forme
  // paresseuse émet un avis à chaque exécution, et une sortie bruyante à
  // chaque montage finit par masquer ce qui compte.
  const [registry] = await sql`SELECT to_regclass('azimut._migrations') AS oid`;
  if (registry.oid === null) {
    await sql`CREATE SCHEMA IF NOT EXISTS azimut`;
    await sql`
      CREATE TABLE azimut._migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
  }

  const applied = await sql`SELECT name FROM azimut._migrations ORDER BY id`;
  const appliedNames = new Set(applied.map((r) => r.name));

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.up.sql'))
    .sort();

  let count = 0;
  for (const file of files) {
    const name = file.replace('.up.sql', '');
    if (appliedNames.has(name)) continue;

    const content = readFileSync(join(migrationsDir, file), 'utf-8');
    await sql.begin(async (tx) => {
      await tx.unsafe(content);
      await tx`INSERT INTO azimut._migrations (name) VALUES (${name})`;
    });
    console.log(`Applied: ${name}`);
    count++;
  }

  if (count === 0) {
    console.log('No pending migrations.');
  } else {
    console.log(`${count} migration(s) applied.`);
  }
} finally {
  await sql.end();
}
