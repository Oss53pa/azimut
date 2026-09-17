import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTIVE_LANGS } from '@azimut/core-model';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION_DIR = resolve(HERE, '..', '..', 'migrations');
const UP = readFileSync(
  resolve(MIGRATION_DIR, '0020_n1_2_missing_fields.up.sql'), 'utf8',
);
const DOWN = readFileSync(
  resolve(MIGRATION_DIR, '0020_n1_2_missing_fields.down.sql'), 'utf8',
);

/**
 * N1.2 — les cinq champs que la partie N spécifie et que le schéma n'avait pas.
 *
 * Ce test garde les contraintes de la base alignées sur le modèle, et interdit
 * à la migration de toucher aux données existantes (A2.2-7).
 */
describe('migration 0020', () => {
  it('ajoute les cinq colonnes de N1.2', () => {
    for (const column of [
      'active_langs',
      'reference_elevation_m',
      'default_edge_width_m',
      'valid_from',
      'valid_to',
    ]) {
      expect(UP).toContain(`ADD COLUMN ${column}`);
    }
  });

  it('ne transforme ni ne supprime aucune donnée', () => {
    // A2.2-7 : une migration qui détruirait ou transformerait des données
    // existantes relève de l'arrêt obligatoire. Celle-ci ajoute, et rien de
    // plus : pas d'UPDATE, pas de DELETE, pas de DROP, pas de NOT NULL qui
    // aurait exigé une valeur par défaut affirmant quelque chose de faux.
    for (const forbidden of ['UPDATE ', 'DELETE ', 'DROP ', 'NOT NULL', 'DEFAULT']) {
      expect(UP).not.toContain(forbidden);
    }
  });

  it('contraint active_langs sur les mêmes langues que le modèle', () => {
    const declared = ACTIVE_LANGS.map(lang => `'${lang}'`).join(', ');
    expect(UP).toContain(`ARRAY[${declared}]::text[]`);
  });

  it('tolère active_langs non déclaré mais interdit le tableau vide', () => {
    expect(UP).toContain('active_langs IS NULL');
    expect(UP).toContain('cardinality(active_langs) >= 1');
  });

  it('interdit une largeur d’arête par défaut nulle ou négative', () => {
    expect(UP).toContain('default_edge_width_m > 0');
  });

  it('interdit une période d’occupation renversée', () => {
    expect(UP).toContain('valid_from <= valid_to');
  });

  it('se défait sans condition préalable', () => {
    for (const column of [
      'active_langs',
      'reference_elevation_m',
      'default_edge_width_m',
      'valid_from',
      'valid_to',
    ]) {
      expect(DOWN).toContain(`DROP COLUMN IF EXISTS ${column}`);
    }
  });
});
