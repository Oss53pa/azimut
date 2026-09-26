import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * A9, version 28 — « Cette section s'applique à tout code qui produit une
 * sortie ou une empreinte : les moteurs, le noyau, le compilateur et
 * l'exécution de borne. Ce n'est pas le nom du dossier qui décide, c'est le
 * fait de produire. L'interface du studio [...] en est exclue, sauf pour ce qui
 * alimente une empreinte. [...] Un contrôle automatique refuse toute
 * comparaison localisée introduite là où cette section s'applique. »
 *
 * Le périmètre contrôlé :
 * - tous les paquets de `packages/` : moteurs et noyau, mais aussi le chargeur
 *   de règles et la trousse d'essai, qui calculent des empreintes, et les
 *   paquets qui n'en portent aucune aujourd'hui, pour qu'ils n'en gagnent pas ;
 * - le compilateur et l'exécution de borne ;
 * - dans le studio, les fichiers qui importent un point d'entrée d'empreinte
 *   (`EMPREINTE_ENTRY_POINTS`). Chacun de ces points ordonne lui-même ses
 *   ensembles par points de code (D7.2) : l'ordre produit en amont n'entre pas
 *   dans l'empreinte, ce qui y entre passe par ces fichiers.
 *
 * Les occurrences existantes sont relevées dans
 * `a9-releve-comparaisons-localisees.json`. Leur remplacement est une tâche
 * déclarée à la matrice, à exécuter avant le premier livrable réel. Jusque-là,
 * ce contrôle fige le relevé : aucun fichier ne peut en compter une de plus,
 * et un fichier qui en compte une de moins oblige à resserrer le relevé dans
 * le même commit.
 *
 * Est comptée comme comparaison localisée toute mention de `localeCompare`,
 * d'`Intl.Collator`, de `toLocaleLowerCase` ou de `toLocaleUpperCase`, code,
 * essais et commentaires confondus : un décompte sans analyse syntaxique ne
 * laisse rien passer.
 */

const ROOT = resolve(import.meta.dirname, '..');
const BASELINE_PATH = join(import.meta.dirname, 'a9-releve-comparaisons-localisees.json');

const LOCALIZED = /\blocaleCompare\b|\bIntl\s*\.\s*Collator\b|\btoLocale(?:Lower|Upper)Case\b/g;

/** Applications qui produisent une sortie : elles relèvent d'A9 en entier. */
const PRODUCING_APPS = ['apps/compiler', 'apps/kiosk-runtime'] as const;

/**
 * Fonctions dont la valeur est une empreinte, ou qui en calculent une sur
 * leurs arguments. L'essai « chaque producteur direct est listé » garde cette
 * liste à jour.
 */
const EMPREINTE_ENTRY_POINTS = new Set([
  'empreinte', 'empreinteOutcome', 'canonicalContentJson', 'computeFaceContentHash',
  'computeGraphHash', 'computeInputsHash', 'computeScheduleInputsHash', 'generateMessageSchedule',
  'resolvedFaceContentHash', 'computeStaleFaces', 'RouteCache',
  'guardFamilyConsistency', 'guardLibraryImport',
  'assembleKioskPackage', 'kioskManifestContentHash',
  'computeRulesPackChecksum', 'rulesPackEmpreinte',
  'siteChecksum', 'stableChecksum',
  'createBuildDeliveryArchiveHandler',
]);

function countLocalized(source: string): number {
  return source.match(LOCALIZED)?.length ?? 0;
}

function sources(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...sources(path));
    else if (/\.(ts|tsx)$/.test(entry)) found.push(path);
  }
  return found;
}

/** Les noms importés comme valeurs (et non comme types) par un fichier. */
function valueImports(source: string): string[] {
  const names: string[] = [];
  for (const match of source.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s*from/g)) {
    if (match[1] !== undefined) continue;
    for (const part of (match[2] ?? '').split(',')) {
      const name = part.trim();
      if (name === '' || name.startsWith('type ')) continue;
      names.push(name.split(/\s+as\s+/)[0] ?? name);
    }
  }
  return names;
}

function feedsEmpreinte(source: string): boolean {
  return valueImports(source).some(name => EMPREINTE_ENTRY_POINTS.has(name));
}

/** Les fichiers où A9 s'applique. */
function scopedFiles(): string[] {
  const packages = readdirSync(join(ROOT, 'packages'))
    .flatMap(name => sources(join(ROOT, 'packages', name)));
  const apps = PRODUCING_APPS.flatMap(app => sources(join(ROOT, app)));
  const studio = sources(join(ROOT, 'apps', 'studio', 'src'))
    .filter(file => feedsEmpreinte(readFileSync(file, 'utf8')));
  return [...packages, ...apps, ...studio];
}

function currentCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const file of scopedFiles()) {
    const count = countLocalized(readFileSync(file, 'utf8'));
    if (count > 0) counts.set(relative(ROOT, file), count);
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

describe('A9 — le périmètre contrôlé', () => {
  it('le motif reconnaît chaque forme de comparaison localisée', () => {
    expect(countLocalized('a.localeCompare(b)')).toBe(1);
    expect(countLocalized('new Intl.Collator("fr").compare')).toBe(1);
    expect(countLocalized('s.toLocaleLowerCase(); s.toLocaleUpperCase()')).toBe(2);
    expect(countLocalized('codePointCompare(a, b); s.toLowerCase()')).toBe(0);
  });

  it('un fichier du studio alimente une empreinte s’il en importe un point d’entrée', () => {
    expect(feedsEmpreinte("import { computeGraphHash } from '@azimut/engine-graph';")).toBe(true);
    expect(feedsEmpreinte("import {\n  a,\n  computeInputsHash as h,\n} from 'x';")).toBe(true);
    expect(feedsEmpreinte("import type { computeGraphHash } from 'x';")).toBe(false);
    expect(feedsEmpreinte("import { readSessionGraph } from './session-graph.js';")).toBe(false);
  });

  /**
   * Un producteur nouveau, qui appellerait la forme canonique sans exporter de
   * point d'entrée listé, ferait sortir du contrôle le studio qui l'emploie.
   */
  it('chaque producteur direct d’empreinte exporte un point d’entrée listé', () => {
    const producers = [
      ...readdirSync(join(ROOT, 'packages')).flatMap(name => sources(join(ROOT, 'packages', name))),
      ...PRODUCING_APPS.flatMap(app => sources(join(ROOT, app))),
    ].filter(file => !/__tests__|\.test\./.test(file) && !file.endsWith('empreinte.ts'));
    const unlisted = producers
      .filter(file => /\b(?:empreinteOutcome|canonicalContentJson)\(/.test(readFileSync(file, 'utf8')))
      .filter(file => {
        const exported = [...readFileSync(file, 'utf8')
          .matchAll(/export\s+(?:async\s+)?(?:function|class|const)\s+(\w+)/g)].map(m => m[1]);
        return !exported.some(name => name !== undefined && EMPREINTE_ENTRY_POINTS.has(name));
      })
      .map(file => relative(ROOT, file));
    expect(unlisted).toEqual([]);
  });
});

describe('A9 — aucune comparaison localisée nouvelle là où la section s’applique', () => {
  it('aucun fichier du périmètre n’en compte plus que le relevé', () => {
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
