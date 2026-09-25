import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * D7.2 — « Une seule implantation. L'empreinte est calculée par une seule
 * fonction, employée par tous les appelants. Deux implantations équivalentes
 * aujourd'hui divergeront demain, et l'invariant 4 repose sur elles. »
 *
 * L'empreinte de contenu est `computeFaceContentHash`, dans core-model. Seul
 * son module appelle la forme canonique `empreinte` ; un second appelant
 * serait une seconde implantation.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ALLOWED = new Set([
  'packages/core-model/src/empreinte.ts',
  'packages/core-model/src/face-content-hash.ts',
]);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (name === 'node_modules' || name === 'dist' || name === '__tests__') return [];
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('D7.2 — une seule implantation de l’empreinte de contenu', () => {
  it('seul le module de l’empreinte de contenu appelle la forme canonique', () => {
    const callers = ['packages', 'apps']
      .flatMap(top => readdirSync(join(ROOT, top)).map(name => join(ROOT, top, name, 'src')))
      .filter(dir => { try { return statSync(dir).isDirectory(); } catch { return false; } })
      .flatMap(sources)
      .filter(path => /\b(empreinte|canonicalContentJson)\(/.test(readFileSync(path, 'utf8')))
      .map(path => relative(ROOT, path).split('\\').join('/'))
      .filter(path => !ALLOWED.has(path));
    expect(callers).toEqual([]);
  });
});
