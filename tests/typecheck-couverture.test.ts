import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

/**
 * Versions 27 et 28 — aucun fichier TypeScript du dépôt n'échappe au contrôle
 * de types : « un essai que le contrôle de types ignore peut casser sans que
 * rien ne le dise », et un fichier de configuration aussi.
 *
 * `pnpm typecheck` lance le script `typecheck` de chaque paquet, puis celui de
 * la racine. Cet essai relit ces scripts, en tire les projets qu'ils vérifient
 * (`tsc` sans `-p` : le `tsconfig.json` du paquet ; `tsc -p <fichier>` : ce
 * fichier), demande à TypeScript la liste des fichiers de chacun, et la
 * compare aux fichiers TypeScript présents dans le dépôt. Un fichier ajouté
 * hors de tout projet vérifié fait échouer l'essai au lieu d'échapper en
 * silence.
 *
 * Version 27 : le motif `*.test.ts` de `tests/` excluait les quinze essais de
 * bout en bout. Version 28 : cinq fichiers de configuration ne relevaient
 * d'aucun projet ; l'un d'eux, `playwright.config.ts`, portait une fenêtre
 * écrasée qui faisait tourner la suite sous la largeur minimale de F12.
 */

const ROOT = resolve(import.meta.dirname, '..');
const TSC = join(ROOT, 'node_modules', '.bin', 'tsc');
const SKIPPED = new Set(['node_modules', 'dist', '.git', 'test-results', 'playwright-report', '__snapshots__']);

function typescriptSources(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIPPED.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...typescriptSources(path));
    else if (/\.(ts|tsx|mts|cts)$/.test(entry) && !entry.endsWith('.d.ts')) found.push(path);
  }
  return found;
}

/** Les dossiers qui portent un `package.json` : la racine et chaque paquet. */
function packageDirs(): string[] {
  const dirs = [ROOT, join(ROOT, 'tests')];
  for (const group of ['apps', 'packages']) {
    for (const name of readdirSync(join(ROOT, group))) dirs.push(join(ROOT, group, name));
  }
  return dirs.filter(dir => existsSync(join(dir, 'package.json')));
}

/** Les projets TypeScript que le script `typecheck` d'un paquet vérifie. */
function typecheckProjects(dir: string): string[] {
  const manifest: unknown = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const scripts = typeof manifest === 'object' && manifest !== null && 'scripts' in manifest
    ? (manifest as { scripts?: Record<string, string> }).scripts : undefined;
  const script = scripts?.['typecheck'] ?? '';
  return script.split('&&')
    .map(step => step.trim())
    .filter(step => /^tsc\b/.test(step))
    .map(step => join(dir, /-p\s+(\S+)/.exec(step)?.[1] ?? 'tsconfig.json'));
}

function projectFiles(tsconfig: string): string[] {
  const shown: unknown = JSON.parse(execFileSync(TSC, ['--showConfig', '-p', tsconfig], { encoding: 'utf8' }));
  const files = typeof shown === 'object' && shown !== null && 'files' in shown
    ? (shown as { files?: unknown }).files : undefined;
  return Array.isArray(files) ? files.map(file => resolve(dirname(tsconfig), String(file))) : [];
}

describe('Versions 27 et 28 — tout fichier TypeScript du dépôt est vérifié', () => {
  it('chaque fichier TypeScript relève d’un projet que `pnpm typecheck` vérifie', () => {
    const checked = new Set(packageDirs().flatMap(typecheckProjects).flatMap(projectFiles));
    const missing = typescriptSources(ROOT)
      .filter(file => !checked.has(file))
      .map(file => relative(ROOT, file))
      .sort();
    expect(missing).toEqual([]);
  });

  it('les essais de bout en bout et les fichiers de configuration en font partie', () => {
    const checked = new Set(packageDirs().flatMap(typecheckProjects).flatMap(projectFiles));
    const expected = [
      ...typescriptSources(join(ROOT, 'tests', 'e2e')),
      join(ROOT, 'playwright.config.ts'), join(ROOT, 'vitest.config.ts'), join(ROOT, 'vitest.db.config.ts'),
      join(ROOT, 'apps', 'studio', 'vite.config.ts'), join(ROOT, 'packages', 'db', 'drizzle.config.ts'),
    ];
    expect(expected.filter(file => !checked.has(file)).map(file => relative(ROOT, file))).toEqual([]);
  });
});
