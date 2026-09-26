import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * A9, version 27 — « Comparer deux chaînes dans un moteur se fait par leurs
 * points de code, jamais par une comparaison sensible à la langue [...] Un
 * contrôle automatique refuse toute comparaison localisée introduite dans
 * `engine-*`. »
 *
 * Les moteurs en portent déjà cent vingt-quatre, relevées dans
 * `a9-releve-comparaisons-localisees.json`. Leur remplacement est une tâche
 * déclarée à la matrice, à exécuter avant le premier livrable réel. Jusque-là,
 * ce contrôle fige le relevé : aucun fichier ne peut en compter une de plus,
 * et un fichier qui en compte une de moins oblige à resserrer le relevé dans
 * le même commit. Le relevé ne fait donc que décroître, jusqu'à disparaître.
 *
 * Est comptée comme comparaison localisée toute mention de `localeCompare`,
 * d'`Intl.Collator`, de `toLocaleLowerCase` ou de `toLocaleUpperCase`, code,
 * essais et commentaires confondus : un décompte sans analyse syntaxique ne
 * laisse rien passer, au prix de compter aussi une mention en commentaire.
 */

const ROOT = resolve(import.meta.dirname, '..');
const PACKAGES = join(ROOT, 'packages');
const BASELINE_PATH = join(import.meta.dirname, 'a9-releve-comparaisons-localisees.json');

const LOCALIZED = /\blocaleCompare\b|\bIntl\s*\.\s*Collator\b|\btoLocale(?:Lower|Upper)Case\b/g;

function countLocalized(source: string): number {
  return source.match(LOCALIZED)?.length ?? 0;
}

function engineSources(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...engineSources(path));
    else if (/\.(ts|tsx)$/.test(entry)) found.push(path);
  }
  return found;
}

function currentCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  const engines = readdirSync(PACKAGES).filter(name => name.startsWith('engine-'));
  for (const engine of engines) {
    for (const file of engineSources(join(PACKAGES, engine))) {
      const count = countLocalized(readFileSync(file, 'utf8'));
      if (count > 0) counts.set(relative(ROOT, file), count);
    }
  }
  return counts;
}

function readBaseline(): Map<string, number> {
  const raw: unknown = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Relevé A9 illisible : un objet { fichier: nombre } est attendu.');
  }
  const baseline = new Map<string, number>();
  for (const [file, value] of Object.entries(raw)) {
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
      throw new Error(`Relevé A9 : ${file} doit porter un entier positif.`);
    }
    baseline.set(file, value);
  }
  return baseline;
}

describe('A9 — aucune comparaison localisée nouvelle dans engine-*', () => {
  it('le motif reconnaît chaque forme de comparaison localisée', () => {
    expect(countLocalized('a.localeCompare(b)')).toBe(1);
    expect(countLocalized('new Intl.Collator("fr").compare')).toBe(1);
    expect(countLocalized('s.toLocaleLowerCase(); s.toLocaleUpperCase()')).toBe(2);
    expect(countLocalized('codePointCompare(a, b); s.toLowerCase()')).toBe(0);
  });

  it('aucun fichier de moteur n’en compte plus que le relevé', () => {
    const baseline = readBaseline();
    const introduced = [...currentCounts()]
      .filter(([file, count]) => count > (baseline.get(file) ?? 0))
      .map(([file, count]) => `${file} : ${count} (relevé ${baseline.get(file) ?? 0})`);
    expect(introduced, 'Comparer par points de code (codePointCompare), jamais selon une langue').toEqual([]);
  });

  it('le relevé est exact : une occurrence retirée s’y retire aussi', () => {
    const current = currentCounts();
    const stale = [...readBaseline()]
      .filter(([file, count]) => (current.get(file) ?? 0) < count)
      .map(([file, count]) => `${file} : relevé ${count}, compté ${current.get(file) ?? 0}`);
    expect(stale, 'Resserrer tests/a9-releve-comparaisons-localisees.json').toEqual([]);
  });
});
