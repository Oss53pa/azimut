import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(HERE, '..', '..', 'migrations');
const UP = readFileSync(resolve(DIR, '0021_s1_site_origin.up.sql'), 'utf8');
const DOWN = readFileSync(resolve(DIR, '0021_s1_site_origin.down.sql'), 'utf8');

/**
 * S1 — origine du repère site, recopiée du premier calage et jamais modifiée.
 */
describe('migration 0021', () => {
  it('ajoute les deux colonnes de l’origine', () => {
    expect(UP).toContain('ADD COLUMN origin_x numeric');
    expect(UP).toContain('ADD COLUMN origin_y numeric');
  });

  it('impose les deux ensemble ou aucune des deux', () => {
    expect(UP).toContain('(origin_x IS NULL) = (origin_y IS NULL)');
  });

  it('ne transforme ni ne supprime aucune donnée', () => {
    // A2.2-7. Pas de NOT NULL ni de DEFAULT : un repère posé à (0, 0) par
    // défaut se lirait comme un repère déjà fixé, et gèlerait un site entier
    // sur une origine que personne n'a calée.
    for (const forbidden of ['UPDATE ', 'DELETE ', 'DROP ', 'NOT NULL', 'DEFAULT']) {
      expect(UP).not.toContain(forbidden);
    }
  });

  it('se défait sans condition préalable', () => {
    expect(DOWN).toContain('DROP COLUMN IF EXISTS origin_x');
    expect(DOWN).toContain('DROP COLUMN IF EXISTS origin_y');
  });
});
