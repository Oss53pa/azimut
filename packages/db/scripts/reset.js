#!/usr/bin/env node

/**
 * Reconstruit une base de développement vide, puis rejoue les migrations.
 *
 * Deux refus, et ils ne se remplacent pas l'un l'autre :
 *
 *  1. L'environnement doit être déclaré local (A13.1). Une déclaration seule
 *     ne suffit pas : elle traîne dans un terminal.
 *  2. La base doit être jointe par une adresse de bouclage. C'est le fait,
 *     quand la déclaration n'est qu'une intention.
 *
 * Et une limite : le script ne supprime que ce que les migrations ont créé —
 * le schéma `azimut`, la table des migrations et la fonction d'horodatage.
 * L'ancienne version supprimait le schéma `public` entier, ce qui emportait
 * tout ce que la base pouvait porter par ailleurs, et ne supprimait pas
 * `azimut`, où vit l'application. Elle ne remettait donc pas la base à zéro,
 * elle la cassait.
 *
 * Usage : AZIMUT_ENV=local DATABASE_URL=... node scripts/reset.js
 */

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import postgres from 'postgres';

/** A13.1 — trois environnements, et un seul admet une remise à zéro. */
const LOCAL = 'local';

/** Les seules adresses par lesquelles une base locale se joint. */
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '']);

const url = process.env['DATABASE_URL'];
if (!url) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const declared = process.env['AZIMUT_ENV'];
if (declared !== LOCAL) {
  console.error(
    `db:reset refuse de s'exécuter : AZIMUT_ENV vaut ${declared ?? '(non défini)'}, `
    + `et non « ${LOCAL} ».\n`
    + 'Une remise à zéro supprime toutes les données du schéma de '
    + "l'application. Elle n'a de sens qu'en local (A13.1).",
  );
  process.exit(1);
}

let host;
try {
  host = new URL(url).hostname;
} catch {
  console.error('DATABASE_URL n’est pas une URL analysable.');
  process.exit(1);
}

if (!LOOPBACK.has(host)) {
  console.error(
    `db:reset refuse de s'exécuter : la base est jointe par « ${host} », `
    + "qui n'est pas une adresse de bouclage.\n"
    + 'AZIMUT_ENV déclare une intention, l’adresse dit le fait. Les deux '
    + 'doivent concorder.',
  );
  process.exit(1);
}

const sql = postgres(url);

try {
  // Le schéma de l'application, et lui seul.
  await sql.unsafe('DROP SCHEMA IF EXISTS azimut CASCADE');
  // Les deux objets que la migration 0001 pose hors du schéma : le journal
  // des migrations et la fonction d'horodatage. Rien d'autre du schéma
  // `public` n'est touché, parce que rien d'autre n'y appartient au produit.
  await sql.unsafe('DROP TABLE IF EXISTS public._migrations');
  await sql.unsafe('DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE');
  console.log('Schéma azimut supprimé, journal des migrations vidé.');
} finally {
  await sql.end();
}

const migrateScript = join(import.meta.dirname, 'migrate.js');
execFileSync('node', [migrateScript], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: url },
});
