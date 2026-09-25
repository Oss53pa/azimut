import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INSPECTION_SYNC_STATES, INSPECTION_SEVERITIES } from '@azimut/core-model';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION = resolve(HERE, '..', '..', 'migrations', '0044_i5_inspection_tables.up.sql');

/**
 * I5.6 — les énumérés des tournées d'inspection, côté TypeScript et côté base, disent la
 * même chose. Le dépôt refuse une valeur hors liste : si les listes
 * divergeaient, une ligne valide en base ferait échouer la lecture.
 */
function inList(table: string, column: string): readonly string[] {
  const sql = readFileSync(MIGRATION, 'utf-8');
  const start = sql.indexOf(`CREATE TABLE azimut.${table} (`);
  if (start < 0) throw new Error(`table ${table} introuvable dans 0044`);
  const body = sql.slice(start, sql.indexOf(');', start));
  const match = new RegExp(`${column} text NOT NULL(?: DEFAULT '[^']*')?\\s+CHECK \\(${column} IN \\(([^)]+)\\)\\)`).exec(body);
  if (match === null) throw new Error(`CHECK de ${table}.${column} introuvable dans 0044`);
  return (match[1] ?? '').split(',').map(p => p.trim().replace(/^'|'$/g, '')).filter(p => p !== '');
}

describe('I5.6 — tournées : le type et la base coïncident', () => {
  it('inspection_round.sync_state', () => {
    expect([...inList('inspection_round', 'sync_state')].sort()).toEqual([...INSPECTION_SYNC_STATES].sort());
  });

  it('inspection_finding.severity', () => {
    expect([...inList('inspection_finding', 'severity')].sort()).toEqual([...INSPECTION_SEVERITIES].sort());
  });
});
