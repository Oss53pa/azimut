import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

/**
 * S-8 — « Un concepteur peut colorer librement des empreintes, des zones ou des
 * calques pour son propre travail. Cette coloration est propre à
 * l'utilisateur, n'est jamais partagée, n'entre dans aucun livrable, dans aucun
 * export destiné à un tiers et dans aucun paquet de borne. »
 *
 * Quatre « jamais », et la section S10 n'inscrit aucun code d'anomalie pour
 * eux. Ce n'est pas un oubli : un contrôle qui refuserait un rendu portant une
 * coloration de travail supposerait qu'un rendu puisse en porter une. La règle
 * se tient mieux par la structure, exactement comme M01.S7 tient la couche
 * d'habillage hors des calculs — et pour la même raison : un essai qui
 * vérifierait une sortie donnée ne dirait rien de la suivante.
 *
 * Trois barrières :
 *
 *   · `SiteData`, l'entrée de tous les moteurs, ne porte pas `work_color` ;
 *   · aucun paquet `engine-*` ne nomme la table ni ne lit une coloration ;
 *   · la lecture exige un identifiant d'utilisateur, que nul moteur n'a à
 *     donner. C'est la barrière la plus sûre des trois, parce qu'elle tient
 *     même si quelqu'un passait la table à un moteur : il n'aurait pas de quoi
 *     l'ouvrir.
 */

/** La table de la coloration de travail, section S9. */
const WORK_COLOUR_TABLE = 'work_color';

/** Les lectures qui ouvrent une coloration, et qu'aucun moteur ne doit nommer. */
const WORK_COLOUR_READERS = ['workColoursOf', 'activeWorkColourCount'] as const;

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

describe('S-8 — la coloration de travail n’atteint aucun livrable', () => {
  it('les moteurs sont bien tous inspectés', () => {
    const packages = enginePackages();
    expect(packages).toHaveLength(5);
    expect(packages.flatMap(sourceFiles).length).toBeGreaterThan(40);
  });

  it('`SiteData` ne porte pas la coloration de travail', () => {
    const site = readFileSync(resolve(ROOT, 'packages/core-model/src/site.ts'), 'utf-8');
    const body = /export type SiteData = \{([\s\S]*?)\n\};/.exec(site)?.[1];
    expect(body, 'SiteData introuvable : l’essai ne prouverait rien').toBeDefined();
    expect(body === undefined || !/work_colo(?:u)?rs?/i.test(body)).toBe(true);
  });

  it('aucun moteur ne nomme la table ni n’en lit une coloration', () => {
    const offenders: string[] = [];
    for (const file of enginePackages().flatMap(sourceFiles)) {
      const source = readFileSync(file, 'utf-8');
      // Le pluriel compte : un champ `work_colors` porte la même table.
      if (new RegExp(`\\b${WORK_COLOUR_TABLE}s?\\b`).test(source)) {
        offenders.push(`${relative(ROOT, file)} : ${WORK_COLOUR_TABLE}`);
      }
      for (const reader of WORK_COLOUR_READERS) {
        if (source.includes(reader)) {
          offenders.push(`${relative(ROOT, file)} : ${reader}`);
        }
      }
    }
    expect(
      offenders,
      'S-8 : un moteur atteint une coloration de travail.\n' + offenders.join('\n'),
    ).toHaveLength(0);
  });

  it('aucun paquet de borne ni compilateur ne les nomme non plus', () => {
    // « aucun paquet de borne » est l'un des quatre jamais, et le compilateur
    // est ce qui fabrique les livrables. Les deux autres surfaces citées par
    // S-8 — le livrable et l'export destiné à un tiers — sortent d'ici.
    const offenders: string[] = [];
    const surfaces = [
      resolve(ROOT, 'apps/compiler/src'),
      resolve(ROOT, 'apps/kiosk-runtime/src'),
    ];
    for (const file of surfaces.flatMap(sourceFiles)) {
      const source = readFileSync(file, 'utf-8');
      if (new RegExp(`\\b${WORK_COLOUR_TABLE}s?\\b`).test(source)) {
        offenders.push(`${relative(ROOT, file)} : ${WORK_COLOUR_TABLE}`);
      }
      for (const reader of WORK_COLOUR_READERS) {
        if (source.includes(reader)) offenders.push(`${relative(ROOT, file)} : ${reader}`);
      }
    }
    expect(offenders, offenders.join('\n')).toHaveLength(0);
  });

  it('la mesure reconnaîtrait une infraction, sinon elle ne mesure rien', () => {
    const forged = 'const c = workColoursOf(site.work_colors, userId);';
    expect(new RegExp(`\\b${WORK_COLOUR_TABLE}s?\\b`).test(forged)).toBe(true);
    expect(WORK_COLOUR_READERS.some(r => forged.includes(r))).toBe(true);
  });
});
