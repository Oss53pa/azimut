import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * T-0.2 et A13.2 — « aucune étape ignorée en silence ».
 *
 * Une suite sur base se saute quand une variable de son banc manque : c'est ce
 * qui la rend lançable sur un poste nu. En CI, une suite sautée serait un vert
 * menteur. Deux gardes l'empêchent : celle d'A10.4 (`AZIMUT_REQUIRE_POSTGREST`),
 * qui échoue si la base, PostgREST ou le secret du banc manquent, et celle
 * d'AUTH.2 (`AZIMUT_REQUIRE_AUTH`), pour le service d'authentification.
 *
 * Elles ne couvrent que les variables qu'elles vérifient. Cet essai prouve
 * qu'aucune suite sur base ne dépend d'une autre : une suite qui en lirait une
 * nouvelle pourrait se sauter en CI sans que rien ne rougisse.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Ce que les deux gardes vérifient, et les deux variables qui les arment. */
const GUARDED = new Set([
  'AZIMUT_TEST_DATABASE_URL', 'AZIMUT_TEST_POSTGREST', 'AZIMUT_TEST_POSTGREST_DB_URI', 'AZIMUT_TEST_JWT_SECRET',
  'AZIMUT_TEST_AUTH_BINARY', 'AZIMUT_TEST_AUTH_DATABASE_URL', 'AZIMUT_TEST_AUTH_DB_URI', 'AZIMUT_TEST_AUTH_POSTGREST_DB_URI',
  'AZIMUT_REQUIRE_POSTGREST', 'AZIMUT_REQUIRE_AUTH',
]);

function dbSuites(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (name === 'node_modules' || name === 'dist') return [];
    if (statSync(path).isDirectory()) return dbSuites(path);
    return name.endsWith('.db.test.ts') ? [path] : [];
  });
}

const suites = ['packages', 'apps'].flatMap(top => dbSuites(join(ROOT, top)));

describe('T-0.2 — aucune suite sur base ne peut se sauter en silence en CI', () => {
  it('les suites sont bien trouvées', () => {
    expect(suites.length).toBeGreaterThan(30);
  });

  it('chaque variable qu’une suite lit est vérifiée par une garde de la chaîne', () => {
    const unguarded: string[] = [];
    for (const file of suites) {
      for (const [, name] of readFileSync(file, 'utf-8').matchAll(/process\.env\[['"]([A-Z0-9_]+)['"]\]/g)) {
        if (name !== undefined && !GUARDED.has(name)) unguarded.push(`${relative(ROOT, file)} : ${name}`);
      }
    }
    expect(unguarded, 'Variable lue par une suite sur base sans garde en CI :\n' + unguarded.join('\n')).toEqual([]);
  });

  it('les deux gardes existent, et la chaîne les arme', () => {
    const ci = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf-8');
    for (const [variable, file] of [
      ['AZIMUT_REQUIRE_POSTGREST', 'packages/db/src/__tests__/a10-4-etancheite-postgrest.db.test.ts'],
      ['AZIMUT_REQUIRE_AUTH', 'packages/db/src/__tests__/auth-2-connexion-reelle.db.test.ts'],
    ] as const) {
      expect(ci).toMatch(new RegExp(`${variable}: '1'`));
      expect(readFileSync(join(ROOT, file), 'utf-8')).toMatch(/describe\.runIf\(required\)/);
    }
  });
});
