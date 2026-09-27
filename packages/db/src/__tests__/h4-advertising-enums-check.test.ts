import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AD_BOOKING_STATES, AD_SANITATION_STATES, AD_CREATIVE_VERDICTS } from '@azimut/core-model';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION = resolve(HERE, '..', '..', 'migrations', '0045_h4_advertising_tables.up.sql');

/**
 * H4 — les énumérés de la régie, côté TypeScript et côté base, disent la
 * même chose. Le dépôt refuse une valeur hors liste : si les listes
 * divergeaient, une ligne valide en base ferait échouer la lecture.
 */
function inList(table: string, column: string): readonly string[] {
  const sql = readFileSync(MIGRATION, 'utf-8');
  const start = sql.indexOf(`CREATE TABLE azimut.${table} (`);
  if (start < 0) throw new Error(`table ${table} introuvable dans 0045`);
  const body = sql.slice(start, sql.indexOf(');', start));
  const match = new RegExp(`${column} text NOT NULL(?: DEFAULT '[^']*')?\\s+CHECK \\(${column} IN \\(([^)]+)\\)\\)`).exec(body);
  if (match === null) throw new Error(`CHECK de ${table}.${column} introuvable dans 0045`);
  return (match[1] ?? '').split(',').map(p => p.trim().replace(/^'|'$/g, '')).filter(p => p !== '');
}

describe('H4 — régie : le type et la base coïncident', () => {
  it('ad_booking.state', () => {
    expect([...inList('ad_booking', 'state')].sort()).toEqual([...AD_BOOKING_STATES].sort());
  });

  it('ad_creative.sanitation', () => {
    expect([...inList('ad_creative', 'sanitation')].sort()).toEqual([...AD_SANITATION_STATES].sort());
  });

  it('ad_creative.verdict', () => {
    expect([...inList('ad_creative', 'verdict')].sort()).toEqual([...AD_CREATIVE_VERDICTS].sort());
  });
});
