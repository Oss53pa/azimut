#!/usr/bin/env node

/**
 * Charge les référentiels globaux depuis leurs fichiers.
 *
 * M00.PL2 : « Les référentiels globaux, paquets de règles, devises et taux de
 * taxe, ne sont rattachés à aucune organisation et sont en lecture seule pour
 * l'application. Ils sont alimentés par fichier et migration, jamais par
 * l'interface. » Ce script est la seconde moitié : la migration pose la table,
 * ce script y verse le fichier.
 *
 * Il s'exécute dans tous les environnements, à chaque déploiement — à la
 * différence de `db:reset`, qui refuse hors du local. Un référentiel absent en
 * production ferait refuser des créations de site pour une raison qui n'a rien
 * de métier.
 *
 * La table reflète le fichier : ce qui n'y figure plus est retiré. Un pays
 * retiré d'ISO 3166 ne doit pas survivre dans la table parce que personne n'a
 * pensé à l'en sortir.
 *
 * Usage : DATABASE_URL=... node scripts/seed-reference.js
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';

const url = process.env['DATABASE_URL'];
if (!url) {
  console.error('DATABASE_URL est requis.');
  process.exit(1);
}

const file = join(import.meta.dirname, '..', 'src', 'reference', 'country.json');
const parsed = JSON.parse(readFileSync(file, 'utf-8'));
const countries = Array.isArray(parsed.countries) ? parsed.countries : [];

const CODE = /^[A-Z]{2}$/;
const problems = [];
for (const row of countries) {
  const where = `pays ${String(row?.code)}`;
  if (!CODE.test(String(row?.code))) problems.push(`${where} : code invalide`);
  if (!row?.name_fr) problems.push(`${where} : nom français absent`);
  if (!row?.name_en) problems.push(`${where} : nom anglais absent`);
  if (!Array.isArray(row?.timezones)) problems.push(`${where} : fuseaux absents`);
  // Même exigence que pour une règle d'un paquet : sans référence
  // documentaire, la ligne ne dit pas d'où elle vient. Le fichier entier est
  // refusé, pas seulement la ligne.
  if (!row?.source_ref) problems.push(`${where} : référence documentaire absente`);
}
if (countries.length === 0) problems.push('aucun pays dans le fichier');
if (problems.length > 0) {
  console.error('Référentiel des pays refusé :');
  for (const problem of problems.slice(0, 10)) console.error(`  · ${problem}`);
  process.exit(1);
}

// Triés : deux exécutions doivent écrire dans le même ordre (A9).
const sorted = [...countries].sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
const sql = postgres(url);

try {
  await sql.begin(async (tx) => {
    for (const row of sorted) {
      await tx`
        INSERT INTO azimut.country
          (code, name_fr, name_en, timezones, default_currency_code, source_ref)
        VALUES (
          ${row.code}, ${row.name_fr}, ${row.name_en},
          ${sql.json(row.timezones)},
          ${row.default_currency_code ?? null}, ${row.source_ref}
        )
        ON CONFLICT (code) DO UPDATE SET
          name_fr = EXCLUDED.name_fr,
          name_en = EXCLUDED.name_en,
          timezones = EXCLUDED.timezones,
          default_currency_code = EXCLUDED.default_currency_code,
          source_ref = EXCLUDED.source_ref`;
    }
    const codes = sorted.map((row) => row.code);
    await tx`DELETE FROM azimut.country WHERE code <> ALL(${codes})`;
  });
  console.log(`Référentiel des pays : ${sorted.length} lignes.`);
  console.log(`Référence : ${parsed.source_ref ?? '(absente)'}`);
} finally {
  await sql.end();
}
