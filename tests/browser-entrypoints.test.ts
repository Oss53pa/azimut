/**
 * Garde-fou : aucun module Node dans ce que le navigateur embarque.
 *
 * Le studio est une application navigateur. Un `node:crypto` ou un
 * `node:fs` atteint depuis son point d'entrée casse son build, et rien
 * dans les quatre commandes de vérification ne le voit : typecheck,
 * lint et tests passent, seul le build échoue. C'est arrivé.
 *
 * Ce test parcourt le graphe d'imports depuis le point d'entrée réel du
 * studio et échoue si un `node:` y est atteignable. Les sous-chemins de
 * l'espace de travail sont suivis comme les autres : certains sont
 * légitimes côté navigateur, et c'est la présence de `node:` au bout du
 * chemin qui tranche, pas la forme de l'import.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

/** Point d'entrée réel du paquet navigateur. */
const BROWSER_ENTRY = resolve(ROOT, 'apps/studio/src/main.tsx');

/** Entrée d'un paquet de l'espace de travail, sous-chemins compris. */
function workspaceEntry(spec: string): string | null {
  const segments = spec.split('/');
  const name = segments[1] ?? '';
  const subpath = segments.length > 2 ? `./${segments.slice(2).join('/')}` : '.';
  for (const dir of ['packages', 'apps']) {
    const manifest = resolve(ROOT, dir, name, 'package.json');
    if (!existsSync(manifest)) continue;
    const parsed: unknown = JSON.parse(readFileSync(manifest, 'utf-8'));
    if (typeof parsed !== 'object' || parsed === null) continue;
    const exportsField = (parsed as { exports?: unknown }).exports;
    if (typeof exportsField !== 'object' || exportsField === null) continue;
    const target = (exportsField as Record<string, unknown>)[subpath];
    if (typeof target !== 'object' || target === null) continue;
    const entry = (target as { import?: unknown }).import;
    if (typeof entry !== 'string') continue;
    return resolve(ROOT, dir, name, entry);
  }
  return null;
}

/** Résout un spécificateur relatif, en rendant l'extension source. */
function resolveRelative(fromFile: string, spec: string): string | null {
  const base = resolve(dirname(fromFile), spec);
  const candidates = [
    base.replace(/\.js$/, '.ts'),
    base.replace(/\.js$/, '.tsx'),
    base,
    `${base}.ts`,
    `${base}.tsx`,
    resolve(base, 'index.ts'),
  ];
  return candidates.find(c => existsSync(c) && !c.endsWith('/')) ?? null;
}

const IMPORT_RE = /(?:from|import)\s*['"]([^'"]+)['"]/g;

type Violation = { readonly file: string; readonly spec: string };

function walk(entry: string): { visited: Set<string>; violations: Violation[] } {
  const visited = new Set<string>();
  const violations: Violation[] = [];
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.pop();
    if (file === undefined || visited.has(file)) continue;
    visited.add(file);

    const source = readFileSync(file, 'utf-8');
    for (const match of source.matchAll(IMPORT_RE)) {
      const spec = match[1];
      if (spec === undefined) continue;

      if (spec.startsWith('node:')) {
        violations.push({ file: relative(ROOT, file), spec });
        continue;
      }
      if (spec.startsWith('.')) {
        const next = resolveRelative(file, spec);
        if (next !== null) queue.push(next);
        continue;
      }
      if (spec.startsWith('@azimut/')) {
        const next = workspaceEntry(spec);
        if (next !== null) queue.push(next);
      }
      // Dépendances externes : hors périmètre, le bundler s'en charge.
    }
  }

  return { visited, violations };
}

describe('aucun module Node atteignable depuis le navigateur', () => {
  const result = walk(BROWSER_ENTRY);

  it('parcourt réellement le graphe, sinon le test passerait à vide', () => {
    expect(result.visited.size).toBeGreaterThan(30);
    const visited = [...result.visited].map(f => relative(ROOT, f));
    expect(visited).toContain('packages/rules/src/index.ts');
    expect(visited).toContain('packages/engine-graph/src/index.ts');
  });

  it('n’atteint aucun module node:', () => {
    const detail = result.violations
      .map(v => `${v.file} importe ${v.spec}`)
      .join('\n');
    expect(result.violations, `\n${detail}`).toEqual([]);
  });

  it('n’atteint pas le chargeur de paquets de règles', () => {
    const visited = [...result.visited].map(f => relative(ROOT, f));
    expect(visited).not.toContain('packages/rules/src/loader.ts');
    expect(visited).not.toContain('packages/rules/src/pack-index.ts');
  });

  it('atteint le passage ligne → modèle, sans atteindre l’accès base', () => {
    const visited = [...result.visited].map(f => relative(ROOT, f));
    // Le navigateur lit la base par l'API REST : il lui faut le passage
    // ligne → modèle, jamais l'ORM ni le pilote PostgreSQL qui vont avec.
    expect(visited).toContain('packages/db/src/mapping/index.ts');
    expect(visited).toContain('packages/db/src/mapping/assemble-site-data.ts');
    expect(visited).not.toContain('packages/db/src/load-site-data.ts');
    expect(visited).not.toContain('packages/db/src/connection.ts');
    expect(visited).not.toContain('packages/db/src/index.ts');
  });
});
