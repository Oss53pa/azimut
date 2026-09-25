import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit';
import { buildKioskMapFiles } from '../build-kiosk-tree.js';

/**
 * A5.8 et S-39 — les marques de sécurité d'un plan de borne sont figées à la
 * construction du paquet.
 *
 * Le paquet ne transporte pas les rattachements du site à ses paquets de
 * règles : la borne ne pourrait donc résoudre aucune fonction de pictogramme.
 * La résolution se fait ici, à la construction, sur le site entier, et le
 * pictogramme désigné entre dans le SVG du plan. Le terminal affiche ce SVG
 * et ne décide de rien.
 */

const DESIGNATED = refMultilevel.pictograms.find(p => p.function_key === 'access.accessible');

function plansOf(site: typeof refMultilevel): readonly string[] {
  return [...buildKioskMapFiles(site).values()].map(bytes => new TextDecoder().decode(bytes));
}

describe('Plan de borne — la marque d’accessibilité est figée à la construction', () => {
  it('porte le pictogramme désigné par le paquet rattaché au site', () => {
    expect(DESIGNATED).toBeDefined();
    const path = `d="${DESIGNATED?.svg_path ?? ''}"`;
    expect(plansOf(refMultilevel).some(svg => svg.includes(path))).toBe(true);
  });

  it('ne la porte pas si le site n’est rattaché à aucun paquet : elle se résout à la construction', () => {
    const path = `d="${DESIGNATED?.svg_path ?? ''}"`;
    const unbound = { ...refMultilevel, rules_bindings: [] };
    expect(plansOf(unbound).some(svg => svg.includes(path))).toBe(false);
  });
});
