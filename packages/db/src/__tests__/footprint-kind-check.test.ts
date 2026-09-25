import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FOOTPRINT_KINDS, isFootprintKind } from '@azimut/core-model';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(HERE, '..', '..', 'migrations');

/**
 * A5.2 — l'énuméré fermé côté TypeScript et le CHECK côté base disent la même
 * chose, ou l'un des deux mentirait.
 *
 * Le passage ligne → modèle restreint `footprint.kind` par un cast, adossé à
 * cette contrainte. Si les deux listes divergeaient, le cast laisserait entrer
 * une nature que le type déclare impossible : ce test est ce qui l'empêche.
 *
 * **Il lit la dernière migration qui pose la contrainte, non une migration
 * nommée.** Il visait `0019` en dur, et la version 16 du consolidé, qui ajoute
 * `parking_space`, l'a fait échouer alors que la base était juste : la
 * migration `0046` avait élargi la contrainte, et le test regardait ailleurs.
 * Un test qui désigne une migration par son nom vieillit à la première
 * suivante ; celui-ci relit l'état effectif du schéma.
 */
function kindsDeclaredInMigration(): readonly string[] {
  const sql = readFileSync(effectiveMigration(), 'utf-8');
  // La contrainte, pas la requête laissée en commentaire.
  const constraint = sql.slice(sql.lastIndexOf('ADD CONSTRAINT'));
  const inList = /CHECK \(kind IN \(([^)]+)\)\)/.exec(constraint);
  if (inList === null) throw new Error('CHECK introuvable dans la migration lue');
  return (inList[1] ?? '')
    .split(',')
    .map(part => part.trim().replace(/^'|'$/g, ''))
    .filter(part => part.length > 0);
}

/**
 * La dernière migration montante qui pose `footprint_kind_check`.
 *
 * L'ordre lexicographique des noms est celui d'application : `ORDRE.md` le
 * fixe, et l'y lire ne changerait rien ici puisqu'aucune migration de la
 * contrainte ne porte un numéro en collision.
 */
function effectiveMigration(): string {
  const posantes = readdirSync(MIGRATIONS_DIR)
    .filter(name => name.endsWith('.up.sql'))
    .sort()
    .filter(name => {
      const sql = readFileSync(resolve(MIGRATIONS_DIR, name), 'utf-8');
      return /ADD CONSTRAINT\s+footprint_kind_check/.test(sql);
    });
  const derniere = posantes.at(-1);
  if (derniere === undefined) {
    throw new Error('aucune migration ne pose footprint_kind_check');
  }
  return resolve(MIGRATIONS_DIR, derniere);
}

describe('A5.2 — natures d’empreinte : le type et la base coïncident', () => {
  it('la migration effective déclare exactement les natures du modèle', () => {
    expect([...kindsDeclaredInMigration()].sort())
      .toEqual([...FOOTPRINT_KINDS].sort());
  });

  it('la nature du stationnement y figure, section S8', () => {
    // S-35 : « Une place de stationnement est une empreinte de nature
    // `parking_space`. » Sans cette ligne, l'essai précédent passerait aussi
    // si les deux listes revenaient ensemble aux cinq natures d'avant.
    expect(kindsDeclaredInMigration()).toContain('parking_space');
    expect([...FOOTPRINT_KINDS]).toContain('parking_space');
  });

  it('chaque nature déclarée en base passe la restriction de type', () => {
    for (const kind of kindsDeclaredInMigration()) {
      expect(isFootprintKind(kind), `${kind} refusé par isFootprintKind`).toBe(true);
    }
  });

  it('les natures antérieures ne passent plus', () => {
    // « room », « corridor » et « floor » ont circulé dans les jeux d'essai
    // avant N1.2. Aucune ne doit plus être représentable.
    for (const legacy of ['room', 'corridor', 'floor']) {
      expect(isFootprintKind(legacy), `${legacy} accepté à tort`).toBe(false);
      expect(kindsDeclaredInMigration()).not.toContain(legacy);
    }
  });

  it('aucune migration de la contrainte ne transforme de donnée', () => {
    // Élargir ou resserrer un énuméré ne déplace jamais une ligne : la
    // correspondance d'une nature vers une autre est une décision métier, et
    // elle ne se prend pas en migration. Vérifié sur toutes celles qui posent
    // la contrainte, non sur la dernière seule.
    for (const name of readdirSync(MIGRATIONS_DIR).filter(n => n.endsWith('.up.sql'))) {
      const sql = readFileSync(resolve(MIGRATIONS_DIR, name), 'utf-8');
      if (!/ADD CONSTRAINT\s+footprint_kind_check/.test(sql)) continue;
      const statements = sql
        .split('\n')
        .filter(line => !line.trimStart().startsWith('--'))
        .join('\n');
      expect(statements, `${name} transforme des données`).not.toMatch(/\bUPDATE\b/i);
      expect(statements, `${name} transforme des données`).not.toMatch(/\bDELETE\b/i);
    }
  });
});
