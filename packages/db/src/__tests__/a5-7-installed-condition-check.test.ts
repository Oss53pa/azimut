import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INSTALLED_CONDITIONS } from '@azimut/core-model';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION = resolve(HERE, '..', '..', 'migrations', '0047_a5_7_installed_support_columns.up.sql');

/**
 * A5.7 — l'état constaté d'une pose, côté TypeScript et côté base, disent la
 * même chose. Le dépôt refuse une valeur hors liste : si les listes
 * divergeaient, une ligne valide en base ferait échouer la lecture.
 */
function inList(table: string, column: string): readonly string[] {
  const sql = readFileSync(MIGRATION, 'utf-8');
  const start = sql.indexOf(`ALTER TABLE azimut.${table}`);
  if (start < 0) throw new Error(`table ${table} introuvable dans 0047`);
  const body = sql.slice(start);
  const match = new RegExp(`${column} text CHECK \\(${column} IN \\(([^)]+)\\)\\)`).exec(body);
  if (match === null) throw new Error(`CHECK de ${table}.${column} introuvable dans 0047`);
  return (match[1] ?? '').split(',').map(p => p.trim().replace(/^'|'$/g, '')).filter(p => p !== '');
}

describe('A5.7 — état d’une pose : le type et la base coïncident', () => {
  it('installed_support.condition', () => {
    expect([...inList('installed_support', 'condition')].sort()).toEqual([...INSTALLED_CONDITIONS].sort());
  });
});
