import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(HERE, '..', '..', 'migrations');
const UP = readFileSync(resolve(DIR, '0021_s1_site_origin.up.sql'), 'utf8');
const DOWN = readFileSync(resolve(DIR, '0021_s1_site_origin.down.sql'), 'utf8');


/**
 * Corps SQL sans les commentaires : les assertions portent sur les
 * instructions, pas sur le texte qui explique pourquoi telle instruction est
 * absente — un commentaire qui cite `now()` pour dire qu'il n'est pas employé
 * ne doit pas faire échouer le contrôle.
 */
function statementsOf(sql: string): string {
  return sql
    .split('\n')
    .filter(line => !line.trimStart().startsWith('--'))
    .join('\n');
}

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
      expect(statementsOf(UP)).not.toContain(forbidden);
    }
  });

  it('se défait sans condition préalable', () => {
    expect(DOWN).toContain('DROP COLUMN IF EXISTS origin_x');
    expect(DOWN).toContain('DROP COLUMN IF EXISTS origin_y');
  });
});

const UP_0022 = readFileSync(
  resolve(DIR, '0022_s1_calibration_timestamp.up.sql'), 'utf8',
);
const DOWN_0022 = readFileSync(
  resolve(DIR, '0022_s1_calibration_timestamp.down.sql'), 'utf8',
);

/**
 * S1 — `calibrated_at` rend « le premier calage » identifiable.
 */
describe('migration 0022', () => {
  it('ajoute la date de calage sur plan_calibration', () => {
    expect(UP_0022).toContain('ALTER TABLE azimut.plan_calibration');
    expect(UP_0022).toContain('ADD COLUMN calibrated_at timestamptz');
  });

  it('n’horodate aucune ligne existante', () => {
    // `now()` aurait donné à toute ligne existante la date de la migration,
    // faisant passer une inconnue pour un fait.
    for (const forbidden of ['UPDATE ', 'DELETE ', 'DROP ', 'NOT NULL', 'DEFAULT', 'now()']) {
      expect(statementsOf(UP_0022)).not.toContain(forbidden);
    }
  });

  it('se défait sans condition préalable', () => {
    expect(DOWN_0022).toContain('DROP COLUMN IF EXISTS calibrated_at');
  });
});
