import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * D13, version 29 — « Taille de fenêtre déclarée avec le relevé, pour toute
 * mesure qui dépend d'un rendu [...]. Deux relevés pris dans des fenêtres
 * différentes ne se comparent pas, et un relevé sans cette mention ne vaut
 * pas comme base de révision. »
 *
 * Le relevé du critère 4 de M8 (partie M) est écrit par `tests/e2e/m8-tranche.spec.ts`.
 * Les relevés antérieurs, pris sans cette mention, sont conservés dans
 * `docs/releves-m8-anterieurs.json` et marqués non comparables plutôt
 * qu'effacés.
 */

const DOCS = join(resolve(import.meta.dirname, '..'), 'docs');

function read(name: string): unknown {
  return JSON.parse(readFileSync(join(DOCS, name), 'utf8'));
}

function field(record: unknown, key: string): unknown {
  return typeof record === 'object' && record !== null ? (record as Record<string, unknown>)[key] : undefined;
}

function isWindow(value: unknown): boolean {
  const width = field(value, 'largeur_px');
  const height = field(value, 'hauteur_px');
  return Number.isInteger(width) && Number.isInteger(height) && Number(width) > 0 && Number(height) > 0;
}

describe('D13 — un relevé qui dépend d’un rendu déclare sa fenêtre', () => {
  it('le relevé du critère 4 de M8 (partie M) déclare la fenêtre où il a été pris', () => {
    expect(isWindow(field(read('releve-m8-parcours.json'), 'fenetre'))).toBe(true);
  });

  it('les relevés antérieurs sont conservés, et ceux sans fenêtre marqués non comparables', () => {
    const releves = field(read('releves-m8-anterieurs.json'), 'releves');
    expect(Array.isArray(releves) && releves.length > 0).toBe(true);
    const unmarked = (releves as unknown[])
      .filter(entry => !isWindow(field(field(entry, 'releve'), 'fenetre')) && field(entry, 'comparable') !== false)
      .map(entry => field(entry, 'commit'));
    expect(unmarked).toEqual([]);
  });
});
