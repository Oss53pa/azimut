import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Question 6 de la matrice, décision d'Oss53pa (28 novembre 2026) — aucun
 * essai ne change la posture de cloisonnement du schéma.
 *
 * CLAUDE.md interdit de contourner le cloisonnement par organisation, y
 * compris en essai. Un décor levait `FORCE ROW LEVEL SECURITY` sous le rôle
 * propriétaire : pendant la bascule, toute suite qui tournait en même temps
 * tournait sans cloisonnement forcé. Le décor passe désormais par le rôle de
 * décor du banc (`packages/db/src/fixture-role.ts`, `scripts/role-decor.sh`).
 *
 * Seules les migrations posent la posture. Ailleurs, aucune instruction ne la
 * lève, ne la retire, ni ne désarme une politique.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Ce qui change la posture : lever FORCE, désactiver le cloisonnement, retirer une politique. */
const POSTURE = [
  new RegExp(['no', 'force', 'row', 'level', 'security'].join('\\s+'), 'i'),
  new RegExp(['disable', 'row', 'level', 'security'].join('\\s+'), 'i'),
  new RegExp(['drop', 'policy'].join('\\s+'), 'i'),
  new RegExp(['alter', 'policy'].join('\\s+'), 'i'),
];

const SCANNED = /\.(ts|tsx|mts|mjs|js|sh|sql)$/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (name === 'node_modules' || name === 'dist' || name === 'migrations' || name.startsWith('.')) return [];
    if (statSync(path).isDirectory()) return files(path);
    return SCANNED.test(name) ? [path] : [];
  });
}

const scanned = ['packages', 'apps', 'tests', 'scripts'].flatMap(top => files(join(ROOT, top)));

describe('Question 6 — aucun essai ne change la posture de cloisonnement', () => {
  it('le balayage porte sur le code des essais et des bancs', () => {
    expect(scanned.length).toBeGreaterThan(500);
    expect(scanned.some(f => f.endsWith('.db.test.ts'))).toBe(true);
  });

  it('hors migrations, rien ne lève FORCE, ne désactive le cloisonnement, ni ne touche une politique', () => {
    const found: string[] = [];
    for (const file of scanned) {
      const lines = readFileSync(file, 'utf-8').split('\n');
      lines.forEach((line, i) => {
        if (POSTURE.some(p => p.test(line))) found.push(`${relative(ROOT, file)}:${String(i + 1)} : ${line.trim()}`);
      });
    }
    expect(found, 'Changement de posture hors migrations :\n' + found.join('\n')).toEqual([]);
  });

  it('le rôle de décor est créé par le montage du banc, jamais par une migration', () => {
    const migrations = join(ROOT, 'packages/db/migrations');
    const creating = readdirSync(migrations)
      .filter(name => name.endsWith('.sql') && readFileSync(join(migrations, name), 'utf-8').includes('azimut_fixture'));
    expect(creating).toEqual([]);
    expect(readFileSync(join(ROOT, 'scripts/role-decor.sh'), 'utf-8')).toMatch(/CREATE ROLE azimut_fixture LOGIN NOINHERIT BYPASSRLS/);
  });

  it('la chaîne monte le rôle de décor sur chacune de ses bases d’essai', () => {
    const ci = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf-8');
    expect(ci).toMatch(/scripts\/role-decor\.sh postgres:\/\/postgres@127\.0\.0\.1:54332 azimut\b/);
    expect(ci).toMatch(/scripts\/role-decor\.sh postgres:\/\/postgres@127\.0\.0\.1:54332 azimut_auth\b/);
  });
});
