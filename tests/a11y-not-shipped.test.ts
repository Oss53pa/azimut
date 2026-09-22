import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

/**
 * axe-core est un outil d'essai, jamais un composant du produit.
 *
 * Condition posée à son autorisation : « Jamais dans un livrable. » Une
 * bibliothèque d'analyse d'accessibilité qui partirait dans le studio construit
 * ou dans un paquet de borne ajouterait un demi-mégaoctet à un artefact qui
 * doit tenir hors ligne, et y mettrait du code que personne n'a demandé.
 *
 * Deux barrières, et la seconde attrape ce que la première ne voit pas :
 *
 *   · la déclaration — `axe-core` est en dépendance de développement, à
 *     version exacte, et ne figure dans aucune dépendance d'exécution ;
 *   · la source — aucun fichier du produit ne le nomme, donc aucun assembleur
 *     ne peut l'embarquer.
 *
 * L'inspection des artefacts construits est la troisième barrière. Elle ne
 * vit pas ici : elle est une étape de la chaîne d'intégration, posée après
 * `pnpm build`, puisque rien n'est construit au moment où cette suite tourne.
 */

const PACKAGE_NAME = 'axe-core';

/** Les sources qui composent le produit. Les essais n'en font pas partie. */
const PRODUCT_SOURCES = ['apps', 'packages'] as const;

function manifests(): readonly string[] {
  const found: string[] = ['package.json'];
  for (const area of ['apps', 'packages']) {
    const dir = resolve(ROOT, area);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir)) {
      const manifest = resolve(dir, entry, 'package.json');
      if (existsSync(manifest)) found.push(relative(ROOT, manifest));
    }
  }
  return found;
}

function filesUnder(dir: string): readonly string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) out.push(...filesUnder(full));
    else out.push(full);
  }
  return out;
}

describe('axe-core est un outil d’essai, jamais un livrable', () => {
  it('n’est déclaré qu’en dépendance de développement, à version exacte', () => {
    const offenders: string[] = [];
    let declared = 0;

    for (const path of manifests()) {
      const manifest: unknown = JSON.parse(readFileSync(resolve(ROOT, path), 'utf-8'));
      const { dependencies, devDependencies, peerDependencies } = manifest as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        peerDependencies?: Record<string, string>;
      };

      for (const [kind, table] of [
        ['dependencies', dependencies],
        ['peerDependencies', peerDependencies],
      ] as const) {
        if (table?.[PACKAGE_NAME] !== undefined) offenders.push(`${path} : ${kind}`);
      }

      const dev = devDependencies?.[PACKAGE_NAME];
      if (dev !== undefined) {
        declared += 1;
        // Version exacte : ni `^`, ni `~`, ni plage. Une mise à jour
        // silencieuse changerait le jeu de règles et donc le verdict.
        expect(dev, `${path} : version non figée`).toMatch(/^\d+\.\d+\.\d+$/);
      }
    }

    expect(offenders, offenders.join('\n')).toHaveLength(0);
    expect(declared, 'axe-core doit être déclaré une fois, en développement').toBe(1);
  });

  it('n’est importé par aucune source du produit', () => {
    // C'est la garantie de fond : un assembleur n'embarque que ce qui est
    // importé. Vérifier la source vaut pour toute construction à venir, là où
    // inspecter un `dist` ne vaut que pour celle qu'on vient de faire — et ne
    // vaut rien du tout quand il n'a pas encore été construit.
    //
    // L'inspection des artefacts construits existe aussi : elle est une étape
    // de la chaîne d'intégration, posée après `pnpm build`.
    const offenders: string[] = [];
    let inspected = 0;

    for (const area of PRODUCT_SOURCES) {
      const dir = resolve(ROOT, area);
      if (!existsSync(dir)) continue;
      for (const file of filesUnder(dir)) {
        if (!/\.(ts|tsx|js|jsx|css)$/.test(file)) continue;
        if (file.includes('__tests__') || file.includes('node_modules')) continue;
        if (file.includes(`${sep}dist${sep}`)) continue;
        inspected += 1;
        if (readFileSync(file, 'utf-8').includes(PACKAGE_NAME)) {
          offenders.push(relative(ROOT, file));
        }
      }
    }

    expect(inspected, 'aucune source inspectée : la mesure ne prouverait rien')
      .toBeGreaterThan(200);
    expect(
      offenders,
      'axe-core est un outil d’essai. Ces sources du produit le nomment :\n'
      + offenders.join('\n'),
    ).toHaveLength(0);
  });
});
