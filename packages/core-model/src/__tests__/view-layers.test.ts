import { describe, it, expect } from 'vitest';
import {
  VIEW_LAYER_KEYS, SKETCH_LAYER_KEY, isViewLayerKey,
  stackedLayers, screenLayerKeys, printLayerKeys, auditViewLayers,
  WORK_COLOUR_TARGET_KINDS, isWorkColourTargetKind,
  workColoursOf, activeWorkColourCount,
} from '../view-layers.js';
import type { ViewLayer, ViewLayerKey, WorkColour } from '../view-layers.js';

function layer(
  key: ViewLayerKey,
  z: number,
  visible: boolean,
  printVisible: boolean,
): ViewLayer {
  return {
    id: `vl-${key}`,
    org_id: 'org-1',
    site_id: 'site-1',
    key,
    name: key,
    visible,
    print_visible: printVisible,
    z_order: z,
  };
}

describe('S-10 — les dix calques thématiques', () => {
  it('porte les dix clés de la section S9, dans l’ordre de la règle', () => {
    // Épinglé volontairement : un calque nouveau casse ce test, ce qui force à
    // le déclarer plutôt qu'à le laisser apparaître.
    expect([...VIEW_LAYER_KEYS]).toEqual([
      'base_plan', 'footprints', 'circulation', 'signage', 'advertising',
      'furnishing', 'pictograms', 'annotations', 'sketch', 'dimensions',
    ]);
  });

  it('refuse une clé hors liste, quelle qu’en soit la vraisemblance', () => {
    expect(isViewLayerKey('sketch')).toBe(true);
    // « calques » d'outils voisins, qui ne sont pas des calques d'ici.
    expect(isViewLayerKey('decoration')).toBe(false);
    expect(isViewLayerKey('layer')).toBe(false);
    expect(isViewLayerKey('')).toBe(false);
  });
});

describe('S-11 — deux visibilités distinctes, non l’une dérivée de l’autre', () => {
  it('lit l’écran et l’impression séparément', () => {
    const layers = [
      layer('sketch', 9, true, false),
      layer('footprints', 2, true, true),
      layer('advertising', 5, false, true),
    ];
    expect(screenLayerKeys(layers)).toEqual(['footprints', 'sketch']);
    expect(printLayerKeys(layers)).toEqual(['footprints', 'advertising']);
  });

  it('n’est pas un sous-ensemble : un calque peut n’exister qu’à l’impression', () => {
    // Le cas décisif. Si `print_visible` héritait de `visible`, ce calque
    // sortirait des deux listes, et une mention de repérage ne pourrait plus
    // être portée au seul plan imprimé.
    const layers = [layer('annotations', 1, false, true)];
    expect(screenLayerKeys(layers)).toEqual([]);
    expect(printLayerKeys(layers)).toEqual(['annotations']);
  });

  it('superpose par rang, puis par clé, et non par ordre d’arrivée', () => {
    // INV-4 : deux calques de même rang ne se départagent par rien dans la
    // section, donc la clé tranche. Deux lectures d'un même état rendent la
    // même pile, quel que soit l'ordre des lignes.
    const a = [layer('signage', 3, true, true), layer('circulation', 3, true, true)];
    const b = [layer('circulation', 3, true, true), layer('signage', 3, true, true)];
    expect(stackedLayers(a).map(l => l.key)).toEqual(['circulation', 'signage']);
    expect(stackedLayers(b).map(l => l.key)).toEqual(['circulation', 'signage']);
  });

  it('ne modifie pas la liste qu’on lui donne', () => {
    const layers = [layer('signage', 3, true, true), layer('base_plan', 1, true, true)];
    stackedLayers(layers);
    expect(layers.map(l => l.key)).toEqual(['signage', 'base_plan']);
  });
});

describe('S-11 — l’esquisse ne s’imprime jamais', () => {
  it('admet une esquisse visible à l’écran seule', () => {
    expect(auditViewLayers([layer(SKETCH_LAYER_KEY, 9, true, false)])).toEqual([]);
  });

  it('refuse une esquisse portée à l’impression, écran ou non', () => {
    for (const visible of [true, false]) {
      const findings = auditViewLayers([layer(SKETCH_LAYER_KEY, 9, visible, true)]);
      expect(findings).toHaveLength(1);
      // Le code existait déjà au catalogue : D2.2, « Couche d'esquisse présente
      // dans un export destiné à un tiers ». Un plan imprimé en est un.
      expect(findings[0]?.code).toBe('SKETCH.IN_DELIVERABLE');
      expect(findings[0]?.severity).toBe('blocking');
      expect(findings[0]?.entity).toEqual({ kind: 'view_layer', id: 'vl-sketch' });
      expect(findings[0]?.ruleRef).toBe('S-11');
    }
  });

  it('ne reproche rien aux neuf autres calques portés à l’impression', () => {
    const autres = VIEW_LAYER_KEYS
      .filter(k => k !== SKETCH_LAYER_KEY)
      .map((k, i) => layer(k, i, true, true));
    expect(auditViewLayers(autres)).toEqual([]);
  });

  it('ne corrige pas au vol : le calque garde sa case cochée', () => {
    // Un contrôle qui remettrait `print_visible` à `false` laisserait la case
    // cochée à l'écran suivant, et le concepteur ne saurait pas qu'il l'a
    // cochée. Le refus est ce qui le lui apprend.
    const esquisse = layer(SKETCH_LAYER_KEY, 9, true, true);
    auditViewLayers([esquisse]);
    expect(esquisse.print_visible).toBe(true);
    expect(printLayerKeys([esquisse])).toEqual(['sketch']);
  });
});

describe('S-8 — la coloration de travail est propre à l’utilisateur', () => {
  /**
   * Aucune valeur de couleur n'est écrite ici, et c'est la seule façon
   * d'éprouver ce module sans enfreindre A2.4, « écrire en dur une couleur hors
   * du fichier de jetons de thème » — l'interdiction ne fait pas d'exception
   * pour les essais, et le garde de `no-hardcoded-colors` non plus.
   *
   * Ce qui se vérifie ici n'y perd rien : ce module transporte `hex` sans
   * jamais le lire, parce que la section S9 n'en fixe pas la forme. Ce qu'il
   * faut prouver est qu'une charge utile arrive au bon utilisateur et se résout
   * de la même façon à chaque lecture. Deux repères suffisent, et qu'ils ne
   * ressemblent pas à des couleurs rend même l'essai plus honnête : il ne peut
   * pas passer par accident en comparant deux teintes voisines.
   */
  const MIENNE = 'coloration-a';
  const SIENNE = 'coloration-b';

  function colour(id: string, userId: string, targetId: string, hex: string): WorkColour {
    return {
      id,
      org_id: 'org-1',
      site_id: 'site-1',
      user_id: userId,
      target_kind: 'footprint',
      target_id: targetId,
      hex,
    };
  }

  it('vise ce que la règle nomme, et rien d’autre', () => {
    expect([...WORK_COLOUR_TARGET_KINDS]).toEqual(['footprint', 'zone', 'view_layer']);
    expect(isWorkColourTargetKind('zone')).toBe(true);
    // Un support, une destination, un nœud : la règle ne les nomme pas.
    expect(isWorkColourTargetKind('support')).toBe(false);
    expect(isWorkColourTargetKind('destination')).toBe(false);
  });

  it('ne rend jamais la coloration d’un autre', () => {
    const colours = [
      colour('wc-1', 'u-moi', 'fp-1', MIENNE),
      colour('wc-2', 'u-lui', 'fp-1', SIENNE),
    ];
    expect([...workColoursOf(colours, 'u-moi')]).toEqual([['footprint:fp-1', MIENNE]]);
    expect([...workColoursOf(colours, 'u-lui')]).toEqual([['footprint:fp-1', SIENNE]]);
    expect([...workColoursOf(colours, 'u-personne')]).toEqual([]);
  });

  it('résout deux colorations du même objet de la même façon à chaque lecture', () => {
    // A9. La dernière par identifiant l'emporte, et l'ordre des lignes n'y
    // change rien.
    const dans_un_sens = [
      colour('wc-a', 'u-moi', 'fp-1', MIENNE),
      colour('wc-b', 'u-moi', 'fp-1', SIENNE),
    ];
    const dans_l_autre = [...dans_un_sens].reverse();
    expect(workColoursOf(dans_un_sens, 'u-moi').get('footprint:fp-1')).toBe(SIENNE);
    expect(workColoursOf(dans_l_autre, 'u-moi').get('footprint:fp-1')).toBe(SIENNE);
  });

  it('rend les clés dans un ordre stable', () => {
    const colours = [
      colour('wc-3', 'u-moi', 'fp-3', MIENNE),
      colour('wc-1', 'u-moi', 'fp-1', MIENNE),
      colour('wc-2', 'u-moi', 'fp-2', MIENNE),
    ];
    expect([...workColoursOf(colours, 'u-moi').keys()])
      .toEqual(['footprint:fp-1', 'footprint:fp-2', 'footprint:fp-3']);
  });

  it('transporte `hex` sans le juger, parce que S9 n’en fixe pas la forme', () => {
    // Une valeur que nul ne défendrait comme une couleur passe quand même :
    // trancher la forme de `hex` serait inventer une règle absente de la
    // section. La question est au registre, non dans le code.
    const opaque = colour('wc-1', 'u-moi', 'fp-1', 'ce-que-la-base-portait');
    expect(workColoursOf([opaque], 'u-moi').get('footprint:fp-1'))
      .toBe('ce-que-la-base-portait');
  });
});

describe('S-9 — l’interface sait combien de colorations sont actives', () => {
  it('compte celles de l’utilisateur, non celles du site', () => {
    const colours: readonly WorkColour[] = [
      { id: 'wc-1', org_id: 'o', site_id: 's', user_id: 'u-moi', target_kind: 'footprint', target_id: 'fp-1', hex: 'coloration-a' },
      { id: 'wc-2', org_id: 'o', site_id: 's', user_id: 'u-moi', target_kind: 'zone', target_id: 'z-1', hex: 'coloration-b' },
      { id: 'wc-3', org_id: 'o', site_id: 's', user_id: 'u-lui', target_kind: 'footprint', target_id: 'fp-2', hex: 'coloration-c' },
    ];
    expect(activeWorkColourCount(colours, 'u-moi')).toBe(2);
    expect(activeWorkColourCount(colours, 'u-lui')).toBe(1);
    expect(activeWorkColourCount([], 'u-moi')).toBe(0);
  });

  it('rend un compte, non un booléen, pour que l’indicateur soit lisible', () => {
    // S-9 exige que l'interface le dise « en permanence ». « Active » ne dit
    // rien à qui a coloré trois empreintes la semaine passée et l'a oublié.
    const trois: readonly WorkColour[] = ['fp-1', 'fp-2', 'fp-3'].map((t, i) => ({
      id: `wc-${String(i)}`, org_id: 'o', site_id: 's', user_id: 'u',
      target_kind: 'footprint' as const, target_id: t, hex: 'coloration-a',
    }));
    expect(activeWorkColourCount(trois, 'u')).toBe(3);
  });
});
