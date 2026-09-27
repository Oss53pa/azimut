import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ORIENTATION_ZONE_KINDS, NAMING_TARGETS, NAMING_SCOPES, INFORMATION_LEVELS,
} from '@azimut/core-model';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION = resolve(HERE, '..', '..', 'migrations', '0027_n2_2_wayfinding_tables.up.sql');

/**
 * N2.2 — les énumérés du registre du wayfinding, côté TypeScript et côté
 * base, disent la même chose. Le dépôt restreint les lignes lues par ces
 * listes : si elles divergeaient du CHECK, une valeur valide en base serait
 * écartée à la lecture, ou l'inverse.
 */
function inList(column: string): readonly string[] {
  const sql = readFileSync(MIGRATION, 'utf-8');
  const match = new RegExp(`${column} text NOT NULL CHECK \\(${column} IN \\(([^)]+)\\)\\)`).exec(sql);
  if (match === null) throw new Error(`CHECK de ${column} introuvable dans 0027`);
  return (match[1] ?? '').split(',').map(p => p.trim().replace(/^'|'$/g, '')).filter(p => p !== '');
}

describe('N2.2 — registre du wayfinding : le type et la base coïncident', () => {
  it('orientation_zone.kind', () => {
    expect([...inList('kind')].sort()).toEqual([...ORIENTATION_ZONE_KINDS].sort());
  });

  it('naming_rule.target', () => {
    expect([...inList('target')].sort()).toEqual([...NAMING_TARGETS].sort());
  });

  it('naming_rule.uniqueness_scope', () => {
    expect([...inList('uniqueness_scope')].sort()).toEqual([...NAMING_SCOPES].sort());
  });

  it('information_level.level, bornes de H2.3', () => {
    const sql = readFileSync(MIGRATION, 'utf-8');
    const match = /level integer NOT NULL CHECK \(level BETWEEN (\d+) AND (\d+)\)/.exec(sql);
    expect(match).not.toBeNull();
    const [, lo, hi] = match ?? [];
    expect([Number(lo), Number(hi)]).toEqual([INFORMATION_LEVELS[0], INFORMATION_LEVELS.at(-1)]);
    expect(INFORMATION_LEVELS).toHaveLength(Number(hi) - Number(lo) + 1);
  });
});
