import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TENANT_DOSSIER_STATES } from '@azimut/core-model';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION = resolve(HERE, '..', '..', 'migrations', '0046_h5_tenant_sign_tables.up.sql');

/**
 * H5 — les énumérés des enseignes locataires, côté TypeScript et côté base, disent la
 * même chose. Le dépôt refuse une valeur hors liste : si les listes
 * divergeaient, une ligne valide en base ferait échouer la lecture.
 */
function inList(table: string, column: string): readonly string[] {
  const sql = readFileSync(MIGRATION, 'utf-8');
  const start = sql.indexOf(`CREATE TABLE azimut.${table} (`);
  if (start < 0) throw new Error(`table ${table} introuvable dans 0046`);
  const body = sql.slice(start, sql.indexOf(');', start));
  const match = new RegExp(`${column} text NOT NULL(?: DEFAULT '[^']*')?\\s+CHECK \\(${column} IN \\(([^)]+)\\)\\)`).exec(body);
  if (match === null) throw new Error(`CHECK de ${table}.${column} introuvable dans 0046`);
  return (match[1] ?? '').split(',').map(p => p.trim().replace(/^'|'$/g, '')).filter(p => p !== '');
}

describe('H5 — enseignes : le type et la base coïncident', () => {
  it('tenant_sign_dossier.state', () => {
    expect([...inList('tenant_sign_dossier', 'state')].sort()).toEqual([...TENANT_DOSSIER_STATES].sort());
  });
});
