import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { LOCALIZED, ROOT, readBaseline, studioFiles } from './a9-perimetre.js';

/**
 * A9, version 30 — « Dans l'interface, un tri selon la langue de l'utilisateur
 * est légitime, à condition que la langue soit déclarée explicitement et non
 * déduite de la machine. Un contrôle automatique refuse [...], dans
 * l'interface, tout appel qui ne déclare aucune langue. »
 *
 * Le périmètre : les sources du studio qui n'alimentent aucune empreinte, essais
 * compris. Celles qui en alimentent une relèvent de la règle du code qui
 * produit (`a9-comparaison-localisee.test.ts`), plus stricte.
 *
 * La règle diffère de celle des moteurs : une comparaison localisée n'y est pas
 * interdite, un appel sans langue l'est. Une occurrence ne déclare sa langue
 * que si elle est appelée, et que l'argument de langue est écrit et n'est pas
 * `undefined` : le second de `localeCompare`, le premier de
 * `toLocaleLowerCase`, de `toLocaleUpperCase` et d'`Intl.Collator`. Toute
 * autre mention, un commentaire compris, compte comme un appel sans langue :
 * le décompte reste textuel, pour ne rien laisser passer.
 *
 * Les occurrences existantes sont relevées dans
 * `a9-releve-studio-langue-non-declaree.json`, et leur remplacement appartient
 * à la tâche A9 déclarée à la matrice. Le contrôle fige le relevé : aucun
 * fichier ne peut en compter une de plus, et un fichier qui en compte une de
 * moins oblige à resserrer le relevé dans le même commit.
 */

const BASELINE_PATH = join(import.meta.dirname, 'a9-releve-studio-langue-non-declaree.json');

/** Rang de l'argument qui porte la langue, par forme d'appel. */
function languageArgument(name: string): number {
  return name === 'localeCompare' ? 1 : 0;
}

/**
 * Les arguments de l'appel dont la parenthèse ouvrante est en `open`, ou `null`
 * si la parenthèse ne se referme pas. Les chaînes et les imbrications sont
 * sautées : seule une virgule de premier niveau sépare deux arguments.
 */
function callArguments(source: string, open: number): string[] | null {
  const args: string[] = [];
  let depth = 0;
  let start = open + 1;
  for (let i = open; i < source.length; i += 1) {
    const ch = source.charAt(i);
    if (ch === '"' || ch === "'" || ch === '`') {
      const close = endOfString(source, i);
      if (close < 0) return null;
      i = close;
    } else if ('([{'.includes(ch)) depth += 1;
    else if (')]}'.includes(ch)) {
      depth -= 1;
      if (depth === 0) { args.push(source.slice(start, i)); return args; }
    } else if (ch === ',' && depth === 1) { args.push(source.slice(start, i)); start = i + 1; }
  }
  return null;
}

function endOfString(source: string, from: number): number {
  const quote = source.charAt(from);
  for (let i = from + 1; i < source.length; i += 1) {
    if (source.charAt(i) === '\\') { i += 1; continue; }
    if (source.charAt(i) === quote) return i;
  }
  return -1;
}

/** Une occurrence déclare-t-elle sa langue ? */
function declaresLanguage(source: string, at: number, name: string): boolean {
  const open = /^\s*\(/.exec(source.slice(at + name.length));
  if (open === null) return false;
  const args = callArguments(source, at + name.length + open[0].length - 1);
  const language = args?.[languageArgument(name.replace(/\s/g, ''))]?.trim();
  return language !== undefined && language !== '' && language !== 'undefined';
}

function countUndeclared(source: string): number {
  let count = 0;
  for (const match of source.matchAll(LOCALIZED)) {
    if (!declaresLanguage(source, match.index, match[0])) count += 1;
  }
  return count;
}

function currentCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const file of studioFiles().interface) {
    const count = countUndeclared(readFileSync(file, 'utf8'));
    if (count > 0) counts.set(relative(ROOT, file), count);
  }
  return counts;
}

describe('A9 — ce qui déclare une langue dans l’interface', () => {
  it('un appel déclare sa langue par l’argument prévu, écrit et défini', () => {
    expect(countUndeclared('a.localeCompare(b, lang)')).toBe(0);
    expect(countUndeclared("a.localeCompare(b, 'fr', { sensitivity: 'base' })")).toBe(0);
    expect(countUndeclared("s.toLocaleLowerCase('fr'); new Intl.Collator(lang).compare")).toBe(0);
    expect(countUndeclared('a.localeCompare(f(b, c), active.lang)')).toBe(0);
  });

  it('sans cet argument, ou avec undefined, l’appel déduit la langue de la machine', () => {
    expect(countUndeclared('a.localeCompare(b)')).toBe(1);
    expect(countUndeclared('a.localeCompare(b, undefined, { numeric: true })')).toBe(1);
    expect(countUndeclared('s.toLocaleUpperCase(); new Intl.Collator().compare')).toBe(2);
    expect(countUndeclared("a.localeCompare(f(b, 'x,y'))")).toBe(1);
  });

  it('une mention qui n’est pas un appel compte aussi : le décompte reste textuel', () => {
    expect(countUndeclared('// jamais de localeCompare ici')).toBe(1);
    expect(countUndeclared('const compare = String.prototype.localeCompare;')).toBe(1);
  });
});

describe('A9 — aucun appel sans langue nouveau dans l’interface', () => {
  it('aucun fichier de l’interface n’en compte plus que le relevé', () => {
    const baseline = readBaseline(BASELINE_PATH);
    const introduced = [...currentCounts()]
      .filter(([file, count]) => count > (baseline.get(file) ?? 0))
      .map(([file, count]) => `${file} : ${count} (relevé ${baseline.get(file) ?? 0})`);
    expect(introduced, 'Déclarer la langue active, ou comparer par points de code (codePointCompare)').toEqual([]);
  });

  it('le relevé est exact : une occurrence retirée s’y retire aussi', () => {
    const current = currentCounts();
    const stale = [...readBaseline(BASELINE_PATH)]
      .filter(([file, count]) => (current.get(file) ?? 0) < count)
      .map(([file, count]) => `${file} : relevé ${count}, compté ${current.get(file) ?? 0}`);
    expect(stale, 'Resserrer tests/a9-releve-studio-langue-non-declaree.json').toEqual([]);
  });
});
