import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

/**
 * S7 (partie N) — « La couche d'habillage ne participe à aucun calcul. Elle
 * n'apparaît dans aucun quantitatif, aucune zone cliquable, aucun parcours. »
 *
 * La règle se prouve par la structure, et non par l'inspection de trois
 * sorties. Un essai qui vérifierait que `computeQuantities` ignore l'habillage
 * sur un jeu donné ne dirait rien du jeu suivant ; un essai qui montre que les
 * moteurs ne peuvent pas atteindre l'habillage vaut pour tous.
 *
 * Deux barrières, et la seconde suffirait :
 *
 *   · `SiteData`, l'entrée de tous les moteurs, ne porte aucune table
 *     d'habillage ;
 *   · aucun paquet `engine-*` ne nomme l'une de ces tables, ni n'importe quoi
 *     que ce soit de l'atelier.
 */

/** Les tables de la couche d'habillage (E9.3) et de l'esquisse (J3.4). */
const DRESSING_TABLES = [
  'decoration_layer',
  'decoration_shape',
  'imported_asset',
  'layout_composition',
  'sketch_layer',
  'sketch_stroke',
] as const;

/**
 * `annotation` n'entre pas dans cette liste, et c'est délibéré.
 *
 * Deux objets portent ce mot : l'annotation d'habillage de E9.3, qui est
 * imprimée, et l'annotation de révision de J4, qui ne l'est jamais et que
 * `engine-graph` traite légitimement dans `guard-review-closure.ts`. Le nom
 * seul ne les sépare pas ; un garde qui chercherait « annotation » refuserait
 * un emploi conforme. La barrière sur `SiteData` couvre le cas.
 */

function sourceFiles(dir: string): readonly string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (entry.endsWith('.ts') && !full.includes('__tests__')) {
      out.push(full);
    }
  }
  return out;
}

function enginePackages(): readonly string[] {
  return readdirSync(resolve(ROOT, 'packages'))
    .filter(name => name.startsWith('engine-'))
    .map(name => resolve(ROOT, 'packages', name, 'src'));
}

describe('S7 (partie N) — la couche d’habillage ne participe à aucun calcul', () => {
  it('les cinq moteurs sont bien tous inspectés', () => {
    const packages = enginePackages();
    expect(packages).toHaveLength(5);
    expect(packages.flatMap(sourceFiles).length).toBeGreaterThan(40);
  });

  it('`SiteData` ne porte aucune table d’habillage ni d’esquisse', () => {
    const site = readFileSync(resolve(ROOT, 'packages/core-model/src/site.ts'), 'utf-8');
    const body = /export type SiteData = \{([\s\S]*?)\n\};/.exec(site)?.[1];
    expect(body, 'SiteData introuvable : l’essai ne prouverait rien').toBeDefined();

    const carried: string[] = [];
    for (const table of [...DRESSING_TABLES, 'annotation']) {
      if (body !== undefined && new RegExp(`\\b${table}s?\\b`).test(body)) carried.push(table);
    }
    expect(
      carried,
      'S7 : ces tables d’habillage entrent dans l’entrée des moteurs.\n' + carried.join('\n'),
    ).toHaveLength(0);
  });

  it('aucun moteur ne nomme une table d’habillage', () => {
    const offenders: string[] = [];
    for (const file of enginePackages().flatMap(sourceFiles)) {
      const source = readFileSync(file, 'utf-8');
      for (const table of DRESSING_TABLES) {
        // Le pluriel compte : un champ `decoration_layers` porte la même
        // table, et un garde qui ne verrait que le singulier le laisserait
        // passer. C'est le contrôle de fin de fichier qui l'a montré.
        if (new RegExp(`\\b${table}s?\\b`).test(source)) {
          offenders.push(`${relative(ROOT, file)} : ${table}`);
        }
      }
    }
    expect(
      offenders,
      'S7 : un moteur atteint la couche d’habillage.\n' + offenders.join('\n'),
    ).toHaveLength(0);
  });

  it('aucun moteur n’importe quoi que ce soit de l’atelier', () => {
    const offenders: string[] = [];
    for (const file of enginePackages().flatMap(sourceFiles)) {
      const source = readFileSync(file, 'utf-8');
      for (const line of source.split('\n')) {
        if (/^\s*import\b/.test(line) && /studio|editor|viewport/.test(line)) {
          offenders.push(`${relative(ROOT, file)} : ${line.trim()}`);
        }
      }
    }
    expect(offenders, offenders.join('\n')).toHaveLength(0);
  });

  it('la mesure reconnaîtrait une infraction, sinon elle ne mesure rien', () => {
    const forged = 'const layers: readonly DecorationLayer[] = site.decoration_layers;';
    const caught = DRESSING_TABLES.some(t => new RegExp(`\\b${t}s?\\b`).test(forged));
    expect(caught).toBe(true);
  });
});
