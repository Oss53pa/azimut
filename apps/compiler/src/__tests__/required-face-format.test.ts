import { describe, it, expect } from 'vitest';
import { loadRulesPack } from '@azimut/rules/loader';
import { requiredFaceFormat, type RequiredFormatInput } from '../artwork.js';
import { destinationListFontSizeMm } from '@azimut/engine-graph';
import type { LoadedRulesPack, ResolvedFace } from '@azimut/engine-graph';

const FIXTURE = 'packages/testkit/fixtures/rules-packs/test-fixture';

function pack(): LoadedRulesPack {
  const outcome = loadRulesPack(FIXTURE, { environment: 'test' });
  if (!outcome.ok) throw new Error('fixture non chargeable');
  return outcome.value;
}

/** Une face portant une liste de destinations occupant 80 % × 90 % du format. */
function face(names: readonly Readonly<Record<string, string>>[]): ResolvedFace {
  return {
    support_id: 'sup-1',
    node_id: 'n-1',
    template_id: 'tpl-1',
    side: 'front',
    blocks: [{
      kind: 'destination_list',
      ordinal: 0,
      region: { x_pct: 5, y_pct: 10, w_pct: 90, h_pct: 80 },
      content: {
        type: 'destination_list',
        entries: names.map((n, i) => ({
          destination_id: `d-${String(i)}`,
          names: n,
          direction: null,
          distance_m: null,
        })),
      },
    }],
  } as unknown as ResolvedFace;
}

function input(overrides: Partial<RequiredFormatInput> = {}): RequiredFormatInput {
  return {
    supportId: 'sup-1',
    rulesPack: pack(),
    supportRegistry: 'wayfinding',
    supportContext: 'interior',
    readingDistanceM: 5,
    ...overrides,
  };
}

const TWO = [{ fr: 'Sortie', en: 'Exit' }, { fr: 'Accueil', en: 'Reception' }];

/**
 * N4.3 — règle G3. Le format se calcule depuis le contenu, la distance de
 * lecture et la variante linguistique la plus longue. Ce fichier éprouve la
 * lecture de ces trois entrées sur une face résolue ; `face-format.test.ts`
 * éprouve le calcul lui-même.
 */
describe('G3 — le format exigé par une face', () => {
  it('porte la hauteur de caractère que la distance impose', () => {
    // Le paquet d'essai : 5 m × facteur 7 = 35 mm, au-dessus du plancher 33.
    const format = requiredFaceFormat(input(), face(TWO));
    expect(format?.char_height_mm).toBe(35);
  });

  it('calcule une hauteur où le rendu dessine exactement cette taille', () => {
    const format = requiredFaceFormat(input(), face(TWO));
    expect(format).not.toBeNull();
    if (format === null) return;
    expect(destinationListFontSizeMm(format.height_mm * 0.8, 2)).toBeCloseTo(35, 9);
  });

  it('grandit avec la distance de lecture', () => {
    const near = requiredFaceFormat(input({ readingDistanceM: 5 }), face(TWO));
    const far = requiredFaceFormat(input({ readingDistanceM: 20 }), face(TWO));
    expect((far?.height_mm ?? 0)).toBeGreaterThan(near?.height_mm ?? 0);
  });

  it('grandit avec le nombre de lignes, une fois le plafond du rendu franchi', () => {
    const two = requiredFaceFormat(input(), face(TWO));
    const fourteen = requiredFaceFormat(input(), face(Array(7).fill(TWO).flat()));
    expect((fourteen?.height_mm ?? 0)).toBeGreaterThan(two?.height_mm ?? 0);
  });

  it('rend la même hauteur jusqu’à six lignes', () => {
    // Propriété du rendu, pas du calcul : l'interligne y vaut
    // `min(h/(n+0,5) ; 0,15×h)`, donc 15 % de la hauteur du bloc tant que les
    // lignes sont peu nombreuses. Le format exigé ne dépend alors que de la
    // distance de lecture. Le calcul l'inverse fidèlement, plafond compris.
    const two = requiredFaceFormat(input(), face(TWO));
    const six = requiredFaceFormat(input(), face([...TWO, ...TWO, ...TWO]));
    expect(six?.height_mm).toBe(two?.height_mm);
  });

  it('dimensionne sur la variante la plus longue, quelle que soit la langue', () => {
    const measure = (text: string, size: number): number => text.length * size * 0.5;
    // « Reception » est plus long que « Accueil » : c'est lui qui commande.
    const format = requiredFaceFormat(input({ measureText: measure }), face(TWO));
    expect(format?.width_mm).toBeCloseTo(measure('Reception', 35) / 0.9, 9);
  });

  it('laisse la largeur indéterminée sans mesure de texte', () => {
    // Aucune table de métriques n'est versée (G5.1) : inventer une largeur
    // donnerait une face fausse, et le savoir à la pose.
    expect(requiredFaceFormat(input(), face(TWO))?.width_mm).toBeNull();
  });

  it('ne calcule rien sans paquet de règles rattaché', () => {
    // Aucune valeur normative ne doit être substituée à la règle absente (G4).
    expect(requiredFaceFormat(input({ rulesPack: undefined }), face(TWO))).toBeNull();
  });

  it('ne calcule rien sans distance de lecture relevée', () => {
    expect(requiredFaceFormat(input({ readingDistanceM: undefined }), face(TWO))).toBeNull();
    expect(requiredFaceFormat(input({ readingDistanceM: 0 }), face(TWO))).toBeNull();
  });

  it('ne calcule rien sur une face sans liste de destinations', () => {
    expect(requiredFaceFormat(input(), face([]))).toBeNull();
  });

  it('rend deux fois le même format (invariant 4)', () => {
    expect(requiredFaceFormat(input(), face(TWO)))
      .toEqual(requiredFaceFormat(input(), face(TWO)));
  });
});
