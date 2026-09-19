import { describe, it, expect } from 'vitest';
import { computeFaceFormat } from '../face-format.js';
import { destinationListFontSizeMm, destinationListBlockHeightMm } from '../render-face.js';
import type { FaceFormatInput } from '../face-format.js';

function input(overrides: Partial<FaceFormatInput> = {}): FaceFormatInput {
  return {
    entry_count: 4,
    required_char_height_mm: 30,
    // Le bloc occupe 80 % de la hauteur de la face et 90 % de sa largeur.
    block_height_pct: 80,
    block_width_pct: 90,
    ...overrides,
  };
}

/**
 * N4.3 — règle G3. Le format se calcule depuis le contenu, la distance de
 * lecture et la variante linguistique la plus longue.
 */
describe('destinationListBlockHeightMm — l’inverse du dimensionnement du rendu', () => {
  it('rend la hauteur à laquelle le rendu dessine exactement cette taille', () => {
    for (const entries of [1, 2, 5, 12]) {
      for (const size of [8, 30, 120]) {
        const height = destinationListBlockHeightMm(size, entries);
        expect(destinationListFontSizeMm(height, entries)).toBeCloseTo(size, 9);
      }
    }
  });

  it('rend zéro quand il n’y a rien à dessiner', () => {
    expect(destinationListBlockHeightMm(30, 0)).toBe(0);
    expect(destinationListBlockHeightMm(0, 4)).toBe(0);
  });

  it('exige plus de hauteur à mesure que les lignes s’ajoutent', () => {
    const two = destinationListBlockHeightMm(30, 2);
    const eight = destinationListBlockHeightMm(30, 8);
    expect(eight).toBeGreaterThan(two);
  });
});

describe('computeFaceFormat — la hauteur', () => {
  it('calcule une hauteur qui porte la hauteur de caractère exigée', () => {
    const result = computeFaceFormat(input());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Le bloc occupe 80 % de la face ; à cette hauteur-là, le rendu dessine
    // exactement la taille exigée.
    const blockHeight = result.value.height_mm * 0.8;
    expect(destinationListFontSizeMm(blockHeight, 4)).toBeCloseTo(30, 9);
  });

  it('grandit à mesure que le bloc occupe moins de place', () => {
    const large = computeFaceFormat(input({ block_height_pct: 80 }));
    const small = computeFaceFormat(input({ block_height_pct: 40 }));
    expect(large.ok && small.ok).toBe(true);
    if (!large.ok || !small.ok) return;
    expect(small.value.height_mm).toBeCloseTo(large.value.height_mm * 2, 9);
  });

  it('grandit avec la hauteur de caractère exigée, donc avec la distance', () => {
    const near = computeFaceFormat(input({ required_char_height_mm: 15 }));
    const far = computeFaceFormat(input({ required_char_height_mm: 60 }));
    expect(near.ok && far.ok).toBe(true);
    if (!near.ok || !far.ok) return;
    expect(far.value.height_mm).toBeGreaterThan(near.value.height_mm);
  });

  it('rappelle la hauteur de caractère qu’il permet', () => {
    const result = computeFaceFormat(input({ required_char_height_mm: 42 }));
    expect(result.ok && result.value.char_height_mm).toBe(42);
  });
});

describe('computeFaceFormat — la largeur', () => {
  /** Mesure d'essai : chaque caractère vaut la moitié de la hauteur. */
  const measure = (text: string, size: number): number => text.length * size * 0.5;

  it('mesure la variante la plus longue à la taille exigée', () => {
    const result = computeFaceFormat(input({
      longest_variant: 'Consultation',
      measure,
    }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.width_mm).toBeCloseTo(measure('Consultation', 30) / 0.9, 9);
  });

  it('dimensionne sur la plus longue des variantes, pas sur la première', () => {
    const fr = computeFaceFormat(input({ longest_variant: 'Sortie', measure }));
    const en = computeFaceFormat(input({ longest_variant: 'Emergency exit', measure }));
    expect(fr.ok && en.ok).toBe(true);
    if (!fr.ok || !en.ok) return;
    expect(en.value.width_mm ?? 0).toBeGreaterThan(fr.value.width_mm ?? 0);
  });

  it('rend null sans mesure : non calculable, et non nulle', () => {
    // Inventer une largeur donnerait une face fausse, et le savoir à la pose.
    expect(computeFaceFormat(input({ longest_variant: 'Sortie' })).ok).toBe(true);
    const result = computeFaceFormat(input({ longest_variant: 'Sortie' }));
    expect(result.ok && result.value.width_mm).toBeNull();
  });

  it('rend null sans texte à mesurer', () => {
    const result = computeFaceFormat(input({ measure, longest_variant: '' }));
    expect(result.ok && result.value.width_mm).toBeNull();
  });
});

describe('computeFaceFormat — ce qu’il refuse', () => {
  it('refuse une face sans ligne', () => {
    const result = computeFaceFormat(input({ entry_count: 0 }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('DATA.FACE_DIMENSIONS_INVALID');
    expect(result.findings[0]?.params['param']).toBe('entry_count');
    expect(result.findings[0]?.ruleRef).toBe('N4.3');
  });

  it('refuse une hauteur de caractère nulle ou négative', () => {
    const result = computeFaceFormat(input({ required_char_height_mm: 0 }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.params['param']).toBe('required_char_height_mm');
  });

  it('refuse un bloc sans part de la face', () => {
    expect(computeFaceFormat(input({ block_height_pct: 0 })).ok).toBe(false);
    expect(computeFaceFormat(input({ block_width_pct: 0 })).ok).toBe(false);
  });

  it('nomme chaque entrée fautive, pas seulement la première', () => {
    const result = computeFaceFormat(input({ entry_count: 0, required_char_height_mm: -1 }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings).toHaveLength(2);
  });

  it('rend deux fois le même format (invariant 4)', () => {
    const twice = (): ReturnType<typeof computeFaceFormat> =>
      computeFaceFormat(input({
        longest_variant: 'Sortie',
        measure: (text, size) => text.length * size * 0.5,
      }));
    expect(twice()).toEqual(twice());
  });
});
