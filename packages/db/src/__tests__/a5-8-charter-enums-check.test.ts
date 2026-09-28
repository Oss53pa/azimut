import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHARTER_RULE_KINDS, LEXICON_LANGS, LEXICON_SEVERITIES } from '@azimut/core-model';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(HERE, '..', '..', 'migrations');
const MIGRATION = resolve(MIGRATIONS, '0006_a5_5_to_a5_10_remaining.up.sql');

/**
 * A5.8 — les énumérés de la charte, côté TypeScript et côté base, disent la
 * même chose. Le dépôt refuse une valeur hors liste : si les listes
 * divergeaient, une ligne valide en base ferait échouer la lecture.
 */
function inList(table: string, column: string): readonly string[] {
  const redefined = lastRedefinition(table, column);
  if (redefined !== null) return redefined;
  const sql = readFileSync(MIGRATION, 'utf-8');
  const start = sql.indexOf(`CREATE TABLE azimut.${table} (`);
  if (start < 0) throw new Error(`table ${table} introuvable dans 0006`);
  const body = sql.slice(start, sql.indexOf(');', start));
  const match = new RegExp(`${column} text NOT NULL CHECK \\(${column} IN \\(([^)]+)\\)\\)`).exec(body);
  if (match === null) throw new Error(`CHECK de ${table}.${column} introuvable dans 0006`);
  return parseList(match[1] ?? '');
}

/**
 * La dernière contrainte `<table>_<colonne>_check` redéfinie par une migration
 * postérieure, ou `null` s'il n'y en a aucune.
 *
 * Une contrainte redéfinie remplace celle de 0006 : la migration 0054 porte
 * `charter_rule.kind` de cinq natures à sept. Lire 0006 seule comparerait le
 * type au schéma d'avant. Les migrations s'appliquent dans l'ordre de leur nom.
 */
function lastRedefinition(table: string, column: string): readonly string[] | null {
  const pattern = new RegExp(
    `ADD CONSTRAINT ${table}_${column}_check CHECK \\(${column} IN \\(([^)]+)\\)\\)`,
  );
  let found: readonly string[] | null = null;
  for (const file of readdirSync(MIGRATIONS).filter(f => f.endsWith('.up.sql')).sort()) {
    const match = pattern.exec(readFileSync(resolve(MIGRATIONS, file), 'utf-8'));
    if (match !== null) found = parseList(match[1] ?? '');
  }
  return found;
}

function parseList(raw: string): readonly string[] {
  return raw.split(',').map(p => p.trim().replace(/^'|'$/g, '')).filter(p => p !== '');
}

describe('A5.8 — registre de charte : le type et la base coïncident', () => {
  it('charter_rule.kind', () => {
    expect([...inList('charter_rule', 'kind')].sort()).toEqual([...CHARTER_RULE_KINDS].sort());
  });

  it('lexicon_term.lang', () => {
    expect([...inList('lexicon_term', 'lang')].sort()).toEqual([...LEXICON_LANGS].sort());
  });

  it('lexicon_term.severity', () => {
    expect([...inList('lexicon_term', 'severity')].sort()).toEqual([...LEXICON_SEVERITIES].sort());
  });
});
