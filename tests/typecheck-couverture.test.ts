import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * Version 27 — « Ajoute aussi le dossier `tests/` à la vérification de types :
 * un essai que le contrôle de types ignore peut casser sans que rien ne le
 * dise. »
 *
 * `pnpm typecheck` lance `tsc --noEmit` dans chaque paquet de l'espace de
 * travail, `tests/` compris. Jusqu'à la version 27, le `tsconfig.json` de
 * `tests/` ne retenait que `*.test.ts` : les quinze essais de bout en bout de
 * `tests/e2e/` n'étaient vérifiés par rien.
 *
 * Cet essai demande à TypeScript lui-même la liste des fichiers qu'il vérifie,
 * et la compare aux fichiers TypeScript présents dans le dossier. Un fichier
 * ajouté hors du motif fait échouer l'essai au lieu d'échapper en silence.
 */

const TESTS_DIR = resolve(import.meta.dirname);
const ROOT = resolve(TESTS_DIR, '..');
const TSC = join(ROOT, 'node_modules', '.bin', 'tsc');

function typescriptSources(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__snapshots__') continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...typescriptSources(path));
    else if (/\.(ts|tsx|mts|cts)$/.test(entry) && !entry.endsWith('.d.ts')) found.push(path);
  }
  return found;
}

describe('Version 27 — le dossier tests/ est vérifié par le contrôle de types', () => {
  it('chaque fichier TypeScript de tests/ figure dans ce que tsc vérifie', () => {
    const listed = execFileSync(TSC, ['-p', TESTS_DIR, '--listFilesOnly'], { encoding: 'utf8' })
      .split('\n')
      .map(line => line.trim())
      .filter(line => line !== '')
      .map(line => resolve(line));
    const checked = new Set(listed);
    const missing = typescriptSources(TESTS_DIR)
      .filter(file => !checked.has(file))
      .map(file => relative(ROOT, file))
      .sort();
    expect(missing).toEqual([]);
  });

  it('les essais de bout en bout en font partie', () => {
    const e2e = typescriptSources(join(TESTS_DIR, 'e2e'));
    expect(e2e.length).toBeGreaterThan(0);
  });
});
