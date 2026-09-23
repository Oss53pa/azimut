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
  // A4 : le registre est dans le schéma de l'application, en nom pleinement
  // qualifié. Ce script interrogeait `_migrations` sans qualification, donc
  // par le chemin de recherche, donc le schéma par défaut — où la migration
  // 0042 ne l'a justement plus laissé. Il annonçait alors « aucune table de
  // migrations » et rendait zéro : un retour en arrière qui ne fait rien et
  // se déclare réussi. Le code de sortie fait foi, et il disait le contraire
  // de ce qui s'était passé.
  const [registry] = await sql`SELECT to_regclass('azimut._migrations') AS oid`;

  if (registry?.oid === null || registry?.oid === undefined) {
    // Absence de registre : ce n'est pas « rien à défaire », c'est une base
    // dont on ne sait pas ce qu'elle porte. Rendre zéro ferait passer
    // l'ignorance pour un travail achevé.
    console.error(
      'azimut._migrations est absente : cette base n’a jamais été migrée, ou '
      + 'son registre est ailleurs. Rien n’a été défait.',
    );
    process.exit(1);
  }

  const rows = await sql`
    SELECT name FROM azimut._migrations ORDER BY id DESC LIMIT 1
  `;

  const name = rows.length === 0 ? undefined : rows[0]?.name;
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
    await tx`DELETE FROM azimut._migrations WHERE name = ${name}`;
  });
  console.log(`Rolled back: ${name}`);
} finally {
  await sql.end();
}
