import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

/**
 * J3.3 (partie J) — une esquisse « ne participe à aucun calcul » et
 * « n'apparaît dans aucun livrable de fabrication, dans aucun paquet de
 * borne, dans aucun export destiné à un tiers. Contrôle automatisé sur les
 * exports. »
 *
 * Le contrôle tient par la structure, comme celui de la coloration de travail
 * (S-8) : un essai qui vérifierait une sortie donnée ne dirait rien de la
 * suivante. Trois barrières :
 *
 *   · `SiteData`, l'entrée de tous les moteurs et du compilateur, ne porte
 *     aucune esquisse ;
 *   · ni les moteurs, ni le compilateur, ni le paquet de borne, ni la couche
 *     d'accès hors de son schéma ne nomment les tables d'esquisse ;
 *   · dans le studio, seuls les fichiers de l'atelier d'esquisse les nomment :
 *     tout autre fichier qui s'y mettrait — un export, un quantitatif — est
 *     refusé ici avant d'exister.
 */

/** Ce qui ouvre une esquisse : ses tables, et les lectures qui les rendent. */
const SKETCH_MARKERS = /\bsketch_(?:layer|stroke)s?\b|\breadSketch\b|\bloadSketch\b|\bsketchLayer\b|\bsketchStroke\b/;

/** Les fichiers du studio qui tiennent l'atelier d'esquisse, et eux seuls. */
const STUDIO_SKETCH_FILES = new Set([
  'apps/studio/src/state/sketch.ts',
  'apps/studio/src/state/session-from-site.ts',
  'apps/studio/src/app/useSketchInk.tsx',
  'apps/studio/src/app/TrancheRouter.tsx',
  'apps/studio/src/data/postgrest-sketch.ts',
  'apps/studio/src/data/postgrest-repository.ts',
  'apps/studio/src/data/reference-repository.ts',
  'apps/studio/src/data/site-repository.ts',
]);

/** Le schéma de la base, qui déclare les tables sans les lire. */
const DB_SCHEMA_FILES = new Set([
  'packages/db/src/schema/sketch.ts',
  'packages/db/src/schema/index.ts',
]);

function sourceFiles(dir: string): readonly string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== '__tests__' && entry !== 'node_modules') out.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function offendersIn(dirs: readonly string[], allowed: ReadonlySet<string>): readonly string[] {
  return dirs.flatMap(sourceFiles)
    .map(file => relative(ROOT, file))
    .filter(file => !allowed.has(file) && SKETCH_MARKERS.test(readFileSync(resolve(ROOT, file), 'utf-8')));
}

const ENGINES = readdirSync(resolve(ROOT, 'packages'))
  .filter(name => name.startsWith('engine-'))
  .map(name => resolve(ROOT, 'packages', name, 'src'));

describe('J3.3 — l’esquisse n’atteint aucun calcul ni aucun livrable', () => {
  it('les surfaces sont bien toutes inspectées', () => {
    expect(ENGINES).toHaveLength(5);
    expect(ENGINES.flatMap(sourceFiles).length).toBeGreaterThan(40);
    expect(sourceFiles(resolve(ROOT, 'apps/studio/src')).length).toBeGreaterThan(100);
  });

  it('`SiteData` ne porte aucune esquisse', () => {
    const site = readFileSync(resolve(ROOT, 'packages/core-model/src/site.ts'), 'utf-8');
    const body = /export type SiteData = \{([\s\S]*?)\n\};/.exec(site)?.[1];
    expect(body, 'SiteData introuvable : l’essai ne prouverait rien').toBeDefined();
    expect(body === undefined || !/sketch/i.test(body)).toBe(true);
  });

  it('ni moteur, ni compilateur, ni paquet de borne, ni lecture du site ne la nomment', () => {
    const offenders = offendersIn([
      ...ENGINES,
      resolve(ROOT, 'apps/compiler/src'),
      resolve(ROOT, 'apps/kiosk-runtime/src'),
      resolve(ROOT, 'packages/db/src'),
      resolve(ROOT, 'packages/rules/src'),
    ], DB_SCHEMA_FILES);
    expect(offenders, 'J3.3 : une surface de calcul ou de livraison atteint l’esquisse.\n' + offenders.join('\n'))
      .toHaveLength(0);
  });

  it('dans le studio, seul l’atelier d’esquisse la nomme', () => {
    const offenders = offendersIn([resolve(ROOT, 'apps/studio/src')], STUDIO_SKETCH_FILES);
    expect(offenders, 'J3.3 : un fichier du studio hors de l’atelier lit l’esquisse.\n' + offenders.join('\n'))
      .toHaveLength(0);
  });

  it('la liste blanche ne nomme que des fichiers qui existent', () => {
    for (const file of [...STUDIO_SKETCH_FILES, ...DB_SCHEMA_FILES]) {
      expect(() => statSync(resolve(ROOT, file)), file).not.toThrow();
    }
  });

  it('la mesure reconnaîtrait une infraction, sinon elle ne mesure rien', () => {
    expect(SKETCH_MARKERS.test('select * from azimut.sketch_stroke')).toBe(true);
    expect(SKETCH_MARKERS.test('const s = readSketch(rows, level);')).toBe(true);
    expect(SKETCH_MARKERS.test('const sketchy = 1;')).toBe(false);
  });
});
