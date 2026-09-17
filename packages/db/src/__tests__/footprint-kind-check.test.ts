import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FOOTPRINT_KINDS, isFootprintKind } from '@azimut/core-model';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION = resolve(
  HERE, '..', '..', 'migrations', '0019_n1_2_footprint_kind_closed.up.sql',
);

/**
 * N1.2 — l'énuméré fermé côté TypeScript et le CHECK côté base disent la même
 * chose, ou l'un des deux mentirait.
 *
 * Le passage ligne → modèle restreint `footprint.kind` par un cast, adossé à
 * cette contrainte. Si les deux listes divergeaient, le cast laisserait entrer
 * une nature que le type déclare impossible : ce test est ce qui l'empêche.
 */
function kindsDeclaredInMigration(): readonly string[] {
  const sql = readFileSync(MIGRATION, 'utf-8');
  // La contrainte, pas la requête laissée en commentaire.
  const constraint = sql.slice(sql.indexOf('ADD CONSTRAINT'));
  const inList = /CHECK \(kind IN \(([^)]+)\)\)/.exec(constraint);
  if (inList === null) throw new Error('CHECK introuvable dans la migration 0019');
  return (inList[1] ?? '')
    .split(',')
    .map(part => part.trim().replace(/^'|'$/g, ''))
    .filter(part => part.length > 0);
}

describe('N1.2 — natures d’empreinte : le type et la base coïncident', () => {
  it('la migration déclare exactement les cinq natures du modèle', () => {
    expect([...kindsDeclaredInMigration()].sort())
      .toEqual([...FOOTPRINT_KINDS].sort());
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

  it('la migration ne transforme aucune donnée', () => {
    const sql = readFileSync(MIGRATION, 'utf-8');
    const statements = sql
      .split('\n')
      .filter(line => !line.trimStart().startsWith('--'))
      .join('\n');
    expect(statements).not.toMatch(/\bUPDATE\b/i);
    expect(statements).not.toMatch(/\bDELETE\b/i);
  });
});
