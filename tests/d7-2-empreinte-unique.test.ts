import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * D7.2 — « Ces règles valent pour toutes les empreintes du produit […]. Une
 * seconde forme canonique, même implicite, en serait une de trop. » Et : « Une
 * seule implantation. L'empreinte est calculée par une seule fonction,
 * employée par tous les appelants. »
 *
 * La fonction est `empreinte`, dans core-model, et tous les appelants passent
 * par `empreinteOutcome`, qui refuse une valeur non hachable (D2.2). L'essai
 * lit les sources et refuse toute autre voie vers un condensé d'une valeur :
 * `createHash`, `sha256Hex` hors de la forme canonique, ou un condensé posé sur
 * une sérialisation qui n'est pas elle. Ce qui reste permis, c'est le condensé
 * des octets d'un fichier (`sha256Binary`), qui est une somme d'intégrité et
 * non l'empreinte d'une valeur.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FORM = 'packages/core-model/src/empreinte.ts';
const HASH = 'packages/core-model/src/hash.ts';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (name === 'node_modules' || name === 'dist' || name === '__tests__') return [];
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const rel = (path: string): string => relative(ROOT, path).split('\\').join('/');

const ALL: readonly { readonly path: string; readonly text: string }[] = ['packages', 'apps']
  .flatMap(top => readdirSync(join(ROOT, top)).map(name => join(ROOT, top, name, 'src')))
  .filter(dir => { try { return statSync(dir).isDirectory(); } catch { return false; } })
  .flatMap(sources)
  .map(path => ({ path: rel(path), text: readFileSync(path, 'utf8') }));

const matching = (pattern: RegExp): string[] =>
  ALL.filter(f => pattern.test(f.text)).map(f => f.path);

describe('D7.2 — une seule forme canonique, une seule implantation', () => {
  it('la forme canonique n’est définie qu’une fois, dans core-model', () => {
    expect(matching(/\bfunction\s+(empreinte|empreinteOutcome|canonicalContentJson)\b/)).toEqual([FORM]);
  });

  it('seul le module de la forme canonique condense une chaîne', () => {
    expect(matching(/\bsha256Hex\(/).filter(p => p !== HASH)).toEqual([FORM]);
  });

  it('aucun source ne calcule un condensé par une autre bibliothèque', () => {
    expect(matching(/\bcreateHash\b/)).toEqual([]);
  });

  it('aucun condensé ne se pose sur la sérialisation des fichiers de données', () => {
    const offenders = ALL
      .filter(f => f.path !== HASH && /\bcanonicalSerialize\(/.test(f.text) && /\bsha256(Hex|Binary)\(/.test(f.text))
      .map(f => f.path);
    expect(offenders).toEqual([]);
  });

  it('l’ancienne fonction d’empreinte n’existe plus', () => {
    expect(matching(/\bcontentHash\(/)).toEqual([]);
  });
});
