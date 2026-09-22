import { describe, it, expect } from 'vitest';
import {
  NODE_SHAPE, NODE_SHAPES, edgeStroke, DISTINCTION_CHANNEL, NON_COLOUR_CHANNELS,
} from '../graph-encoding.js';
import { NODE_KINDS } from '../graph-input.js';

/**
 * M4 (partie M), « Affichage » — et M7.7 (partie M), « aucune information
 * n'est portée par la seule couleur ».
 */
describe('M4 (partie M) — le graphe se lit sans les couleurs', () => {
  it('les onze types de nœud ont une forme', () => {
    for (const kind of NODE_KINDS) {
      expect(NODE_SHAPE[kind], kind).toBeDefined();
      expect(NODE_SHAPES).toContain(NODE_SHAPE[kind]);
    }
  });

  it('aucune forme n’est une couleur', () => {
    for (const shape of NODE_SHAPES) {
      expect(shape).not.toMatch(/colou?r|red|green|blue|var\(--/i);
    }
  });

  /**
   * Trois types partagent le chevron — les liaisons verticales — et se
   * distinguent par leur libellé. C'est voulu, et c'est déclaré : la
   * distinction reste hors couleur.
   */
  it('les formes partagées le sont entre types de même nature', () => {
    const chevrons = NODE_KINDS.filter(k => NODE_SHAPE[k] === 'chevron');
    expect([...chevrons].sort()).toEqual(['elevator', 'escalator', 'stair']);
    expect(DISTINCTION_CHANNEL['node_kind_within_shape']).toBe('label');
  });

  it('une arête non accessible est en trait interrompu', () => {
    expect(edgeStroke({ accessible: false, evacuationRoute: false }).dashed).toBe(true);
    expect(edgeStroke({ accessible: true, evacuationRoute: false }).dashed).toBe(false);
  });

  it('un cheminement d’évacuation porte un liseré', () => {
    expect(edgeStroke({ accessible: true, evacuationRoute: true }).outlined).toBe(true);
  });

  /** Les deux distinctions se cumulent : une issue de secours non accessible. */
  it('les deux traits se cumulent sur une même arête', () => {
    expect(edgeStroke({ accessible: false, evacuationRoute: true }))
      .toEqual({ dashed: true, outlined: true });
  });

  /**
   * Le contrôle qui mord : chaque distinction que M4 (partie M) nomme passe
   * par un canal qui survit au rendu en niveaux de gris.
   */
  it('chaque distinction passe par un canal hors couleur', () => {
    const distinctions = ['node_kind', 'edge_not_accessible', 'edge_evacuation_route'];
    for (const distinction of distinctions) {
      const channel = DISTINCTION_CHANNEL[distinction];
      expect(channel, distinction).toBeDefined();
      expect(NON_COLOUR_CHANNELS, distinction).toContain(channel);
    }
  });

  it('aucun canal déclaré n’est la couleur', () => {
    expect([...NON_COLOUR_CHANNELS]).not.toContain('colour');
    for (const channel of Object.values(DISTINCTION_CHANNEL)) {
      expect(NON_COLOUR_CHANNELS).toContain(channel);
    }
  });
});
