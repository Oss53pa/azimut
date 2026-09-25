import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * D7.2 — « Une seule implantation. L'empreinte est calculée par une seule
 * fonction, employée par tous les appelants. » Et depuis la version 25 : « Ces
 * règles valent pour toutes les empreintes du produit […]. Une seconde forme
 * canonique, même implicite, en serait une de trop. »
 *
 * La fonction est `empreinte`, dans core-model. L'essai garde deux choses : que
 * personne d'autre ne la réimplante, et que les empreintes déjà alignées ne
 * retombent pas sur l'ancienne sérialisation (`contentHash`, qui écrit `null`
 * pour un champ absent et ne normalise pas en NFC).
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Les modules dont l'empreinte suit la forme canonique de D7.2. */
const ALIGNED = [
  'packages/core-model/src/face-content-hash.ts',
  'packages/engine-graph/src/compute-hashes.ts',
];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (name === 'node_modules' || name === 'dist' || name === '__tests__') return [];
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

function allSources(): string[] {
  return ['packages', 'apps']
    .flatMap(top => readdirSync(join(ROOT, top)).map(name => join(ROOT, top, name, 'src')))
    .filter(dir => { try { return statSync(dir).isDirectory(); } catch { return false; } })
    .flatMap(sources);
}

const rel = (path: string): string => relative(ROOT, path).split('\\').join('/');

describe('D7.2 — une seule implantation de l’empreinte', () => {
  it('la forme canonique n’est définie qu’une fois, dans core-model', () => {
    const definers = allSources()
      .filter(path => /\bfunction\s+(empreinte|canonicalContentJson)\b/.test(readFileSync(path, 'utf8')))
      .map(rel);
    expect(definers).toEqual(['packages/core-model/src/empreinte.ts']);
  });

  it('les empreintes alignées passent par `empreinte`, jamais par l’ancienne sérialisation', () => {
    for (const path of ALIGNED) {
      const text = readFileSync(join(ROOT, path), 'utf8');
      expect(text, path).toMatch(/\bempreinte\(/);
      expect(text, path).not.toMatch(/\b(contentHash|canonicalSerialize|sha256Hex|sha256Binary)\b/);
    }
  });
});
