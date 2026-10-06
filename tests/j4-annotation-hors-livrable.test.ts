import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

/**
 * J4 (partie J) — une annotation de révision « n'apparaît jamais dans un
 * livrable ». R13 : « Un export ne porte aucune annotation de révision. »
 *
 * Même structure que le contrôle de l'esquisse (J3.3) : `SiteData` ne la
 * porte pas, et seuls les fichiers nommés ici peuvent nommer ses tables ou sa
 * lecture. Tout autre fichier — un export, un compilateur, un moteur — qui s'y
 * mettrait est refusé ici avant d'exister.
 */
const MARKERS = /\breview_annotation(?:_reply)?s?\b|\breadAnnotations\b|\breviewAnnotation(?:Reply)?\b/;

/** Les fichiers autorisés à nommer l'annotation, chacun avec sa raison. */
const ALLOWED: Readonly<Record<string, string>> = {
  'apps/studio/src/state/review-annotation.ts': 'Les commandes et la lecture des annotations.',
  'apps/studio/src/app/MessageTableAdapter.tsx': 'Le panneau R7.4, qui les montre et les pose.',
  'packages/db/src/schema/review.ts': 'Le schéma déclaré des deux tables.',
  'packages/db/src/schema/index.ts': 'L’export du schéma.',
  'packages/core-model/src/module-ownership.ts': 'La propriété du module 02 (partie L).',
  'packages/engine-graph/src/message-schedule-state.ts':
    'R12 : le refus d’approbation nomme l’annotation ouverte par son identifiant, sans en lire le contenu.',
};

function sourceFiles(dir: string): readonly string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== '__tests__' && entry !== 'node_modules' && entry !== 'dist') out.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const SURFACES = [
  ...readdirSync(resolve(ROOT, 'packages')).map(name => resolve(ROOT, 'packages', name, 'src')),
  ...readdirSync(resolve(ROOT, 'apps')).map(name => resolve(ROOT, 'apps', name, 'src')),
].filter(dir => { try { return statSync(dir).isDirectory(); } catch { return false; } });

describe('J4 — l’annotation de révision n’atteint aucun livrable', () => {
  it('les surfaces sont bien toutes inspectées', () => {
    expect(SURFACES.length).toBeGreaterThan(8);
    expect(SURFACES.flatMap(sourceFiles).length).toBeGreaterThan(500);
  });

  it('`SiteData` ne porte aucune annotation de révision', () => {
    const site = readFileSync(resolve(ROOT, 'packages/core-model/src/site.ts'), 'utf-8');
    const body = /export type SiteData = \{([\s\S]*?)\n\};/.exec(site)?.[1];
    expect(body, 'SiteData introuvable : l’essai ne prouverait rien').toBeDefined();
    expect(body === undefined || !/review|annotation/i.test(body)).toBe(true);
  });

  it('seuls les fichiers nommés la nomment', () => {
    const offenders = SURFACES.flatMap(sourceFiles)
      .map(file => relative(ROOT, file))
      .filter(file => !(file in ALLOWED) && MARKERS.test(readFileSync(resolve(ROOT, file), 'utf-8')));
    expect(offenders, 'J4 : un fichier hors de la liste lit l’annotation de révision.\n' + offenders.join('\n'))
      .toHaveLength(0);
  });

  it('la liste ne nomme que des fichiers qui existent', () => {
    for (const file of Object.keys(ALLOWED)) {
      expect(() => statSync(resolve(ROOT, file)), file).not.toThrow();
    }
  });

  it('la mesure reconnaîtrait une infraction, sinon elle ne mesure rien', () => {
    expect(MARKERS.test('select * from azimut.review_annotation')).toBe(true);
    expect(MARKERS.test('const a = readAnnotations(rows);')).toBe(true);
    expect(MARKERS.test('const annotation = decorationAnnotation;')).toBe(false);
  });
});
