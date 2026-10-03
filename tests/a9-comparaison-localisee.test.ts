import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  EMPREINTE_ENTRY_POINTS, PRODUCING_APPS, ROOT, countLocalized, feedsEmpreinte,
  sources, studioFiles,
} from './a9-perimetre.js';

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
 * Le relevé des occurrences antérieures au contrôle est tombé à zéro et a
 * disparu : la tâche déclarée à la version 30 les a toutes remplacées par
 * `codePointCompare`. Le contrôle exige désormais zéro, sans exception.
 *
 * Est comptée comme comparaison localisée toute mention de `localeCompare`,
 * d'`Intl.Collator`, de `toLocaleLowerCase` ou de `toLocaleUpperCase`, code,
 * essais et commentaires confondus : un décompte sans analyse syntaxique ne
 * laisse rien passer. Le motif et la frontière avec l'interface sont
 * communs aux deux contrôles d'A9 (`a9-perimetre.ts`).
 */

/** Les fichiers où A9 s'applique. */
function scopedFiles(): string[] {
  const packages = readdirSync(join(ROOT, 'packages'))
    .flatMap(name => sources(join(ROOT, 'packages', name)));
  const apps = PRODUCING_APPS.flatMap(app => sources(join(ROOT, app)));
  return [...packages, ...apps, ...studioFiles().producing];
}

function currentCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const file of scopedFiles()) {
    const count = countLocalized(readFileSync(file, 'utf8'));
    if (count > 0) counts.set(relative(ROOT, file), count);
  }
  return counts;
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

describe('A9 — aucune comparaison localisée là où la section s’applique', () => {
  it('aucun fichier du périmètre n’en compte une seule', () => {
    const found = [...currentCounts()].map(([file, count]) => `${file} : ${count}`);
    expect(found, 'Comparer par points de code (codePointCompare), jamais selon une langue').toEqual([]);
  });
});
