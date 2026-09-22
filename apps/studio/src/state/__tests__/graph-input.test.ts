import { describe, it, expect } from 'vitest';
import {
  acceptNode, acceptEdge, unfoldAxis, NODE_KINDS, VERTICAL_LINK_KINDS,
  EDGE_DIRECTIONS, SLOPE_MIN_PCT, SLOPE_MAX_PCT,
  isAdmissibleSlopePct, isAdmissibleWidthM,
} from '../graph-input.js';
import type { EdgeDraft, EdgeEndpoint, AxisPoint } from '../graph-input.js';
import { EDGE_MIN_LENGTH_M } from '@azimut/core-model';

function endpoint(id: string, x: number, y: number, level = 'level-1', elevation = 0): EdgeEndpoint {
  return { nodeId: id, levelId: level, position: { x_m: x, y_m: y }, elevation_m: elevation };
}

function edge(over: Partial<EdgeDraft> = {}): EdgeDraft {
  return {
    from: endpoint('n1', 0, 0),
    to: endpoint('n2', 10, 0),
    widthM: 1.4,
    slopePct: 0,
    accessible: true,
    direction: 'both',
    evacuationRoute: false,
    hasVerticalLink: false,
    ...over,
  };
}

/** A5.3 — les listes fermées que M4 (partie M) reprend. */
describe('M4 (partie M) — listes fermées de A5.3', () => {
  it('les onze types de nœud', () => {
    expect(NODE_KINDS.length).toBe(11);
    expect(NODE_KINDS).toContain('destination_access');
  });

  it('les quatre natures de liaison verticale', () => {
    expect([...VERTICAL_LINK_KINDS]).toEqual(['elevator', 'stair', 'escalator', 'ramp']);
  });

  it('les trois sens, « les deux » par défaut dans M4 (partie M)', () => {
    expect([...EDGE_DIRECTIONS]).toEqual(['both', 'forward', 'backward']);
    expect(edge().direction).toBe('both');
  });
});

/**
 * M4 (partie M) : « Le type se choisit avant le geste, jamais après. »
 */
describe('M4 (partie M) — nœud', () => {
  it('quantifie la position au millimètre (E4)', () => {
    expect(acceptNode({ kind: 'junction', label: '', position: { x_m: 1.00049, y_m: -0.00009 } }).position)
      .toEqual({ x_m: 1, y_m: 0 });
  });

  it('retire les espaces de bord du libellé, qui reste facultatif', () => {
    expect(acceptNode({ kind: 'entrance', label: '  Entrée nord  ', position: { x_m: 0, y_m: 0 } }).label)
      .toBe('Entrée nord');
    expect(acceptNode({ kind: 'entrance', label: '', position: { x_m: 0, y_m: 0 } }).label).toBe('');
  });
});

/** M4 (partie M) — les trois contrôles à la saisie, et eux seuls. */
describe('M4 (partie M) — arête', () => {
  it('accepte une arête entre deux nœuds distincts du même niveau', () => {
    expect(acceptEdge(edge()).ok).toBe(true);
  });

  it('refuse une arête reliant un nœud à lui-même', () => {
    const r = acceptEdge(edge({ to: endpoint('n1', 10, 0) }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.findings.map(f => f.code)).toEqual(['GRAPH.EDGE_SELF_LOOP']);
  });

  /**
   * Une boucle est aussi de longueur nulle. Lever les deux codes dirait deux
   * fois le même fait, et l'opérateur corrigerait deux choses pour une.
   */
  it('une boucle ne lève pas en plus « longueur nulle »', () => {
    const r = acceptEdge(edge({ to: endpoint('n1', 0, 0) }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.findings.map(f => f.code)).not.toContain('GRAPH.EDGE_ZERO_LENGTH');
  });

  it('refuse une longueur sous la tolérance', () => {
    const r = acceptEdge(edge({ to: endpoint('n2', EDGE_MIN_LENGTH_M / 2, 0) }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.findings.map(f => f.code)).toEqual(['GRAPH.EDGE_ZERO_LENGTH']);
  });

  describe('arête entre niveaux', () => {
    const crossing = edge({ to: endpoint('n2', 0.5, 0, 'level-2', 3.2) });

    it('refuse sans liaison verticale', () => {
      const r = acceptEdge(crossing);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.findings.map(f => f.code)).toEqual(['GRAPH.VERTICAL_LINK_MISSING']);
    });

    /**
     * M4 (partie M) est seul à demander une correction avec le refus : « Refus,
     * avec proposition de créer la liaison. » Un refus qui sait quoi faire et
     * se tait oblige l'opérateur à deviner.
     */
    it('propose de créer la liaison, et nomme les deux niveaux', () => {
      const r = acceptEdge(crossing);
      expect(r.ok).toBe(false);
      expect(r.remedy).toEqual({
        kind: 'create_vertical_link',
        fromLevelId: 'level-1',
        toLevelId: 'level-2',
      });
    });

    it('accepte quand la liaison accompagne l’arête', () => {
      expect(acceptEdge({ ...crossing, hasVerticalLink: true }).ok).toBe(true);
    });

    it('les deux autres refus ne proposent rien : l’écran ne sait pas quoi', () => {
      const boucle = acceptEdge(edge({ to: endpoint('n1', 10, 0) }));
      expect(boucle.ok).toBe(false);
      expect(boucle.remedy).toBeUndefined();
    });
  });
});

/**
 * M4 (partie M), critère 2 — « La longueur n'est jamais saisissable et se
 * recalcule à chaque déplacement. » A5.3 : « `edge.length_m` est calculé,
 * jamais saisi. »
 */
describe('M4 (partie M) — la longueur est calculée, jamais saisie', () => {
  it('ne figure pas dans ce qui est saisissable', () => {
    expect('lengthM' in edge()).toBe(false);
  });

  it('se calcule depuis les deux extrémités', () => {
    const r = acceptEdge(edge({ to: endpoint('n2', 3, 4) }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.lengthM).toBe(5);
  });

  /** Elle tient compte de la dénivelée entre niveaux (M01.S6, partie N). */
  it('compte la dénivelée quand l’arête change de niveau', () => {
    const r = acceptEdge(edge({
      to: endpoint('n2', 3, 0, 'level-2', 4), hasVerticalLink: true,
    }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.lengthM).toBe(5);
  });

  it('se recalcule au déplacement d’une extrémité', () => {
    const avant = acceptEdge(edge({ to: endpoint('n2', 10, 0) }));
    const apres = acceptEdge(edge({ to: endpoint('n2', 20, 0) }));
    expect(avant.ok && apres.ok).toBe(true);
    if (avant.ok && apres.ok) {
      expect(avant.value.lengthM).toBe(10);
      expect(apres.value.lengthM).toBe(20);
    }
  });
});

/**
 * M4 (partie M) ne donne pas de colonne « Erreur » à ses tableaux de
 * propriétés, là où M1 et M3 en ont une : la largeur et la pente sont tenues
 * par le contrôle de saisie, qui refuse la valeur, et non par une anomalie.
 */
describe('M4 (partie M) — bornes de saisie, sans code d’anomalie', () => {
  it('les bornes de pente sont celles de M4 (partie M)', () => {
    expect([SLOPE_MIN_PCT, SLOPE_MAX_PCT]).toEqual([-20, 20]);
  });

  it('admet les bornes exactes et refuse au-delà', () => {
    expect(isAdmissibleSlopePct(-20)).toBe(true);
    expect(isAdmissibleSlopePct(20)).toBe(true);
    expect(isAdmissibleSlopePct(20.1)).toBe(false);
    expect(isAdmissibleSlopePct(Number.NaN)).toBe(false);
  });

  it('la largeur utile est strictement positive', () => {
    expect(isAdmissibleWidthM(0.01)).toBe(true);
    expect(isAdmissibleWidthM(0)).toBe(false);
    expect(isAdmissibleWidthM(-1)).toBe(false);
  });

  /** Aucun code inventé : seuls les trois de M4 (partie M) sont levés. */
  it('n’invente aucun code pour ces bornes', () => {
    const r = acceptEdge(edge({ widthM: 0, slopePct: 99 }));
    expect(r.ok).toBe(true);
  });
});

/**
 * M4 (partie M), critère 1 — « Un axe tracé en une passe produit les nœuds et
 * arêtes attendus, sans doublon. »
 */
describe('M4 (partie M) — axe de circulation', () => {
  function point(x: number, y: number, existing: string | null = null): AxisPoint {
    return { position: { x_m: x, y_m: y }, existingNodeId: existing };
  }

  it('trois points produisent trois sommets et deux arêtes', () => {
    const axis = unfoldAxis([point(0, 0), point(10, 0), point(20, 0)]);
    expect(axis.vertices.length).toBe(3);
    expect(axis.segments).toEqual([[0, 1], [1, 2]]);
  });

  it('réutilise un nœud existant sous le point', () => {
    const axis = unfoldAxis([point(0, 0, 'n-deja-la'), point(10, 0)]);
    expect(axis.vertices[0]).toEqual({
      kind: 'existing', nodeId: 'n-deja-la', position: { x_m: 0, y_m: 0 },
    });
    expect(axis.vertices[1]?.kind).toBe('new');
  });

  it('numérote les nœuds neufs indépendamment des existants', () => {
    const axis = unfoldAxis([point(0, 0), point(10, 0, 'n-x'), point(20, 0)]);
    const neufs = axis.vertices.filter(v => v.kind === 'new');
    expect(neufs.map(v => (v.kind === 'new' ? v.index : -1))).toEqual([0, 1]);
  });

  /** Deux points au même endroit ne font pas une arête de longueur nulle. */
  it('n’empile pas deux points consécutifs identiques', () => {
    const axis = unfoldAxis([point(0, 0), point(0, 0), point(10, 0)]);
    expect(axis.vertices.length).toBe(2);
    expect(axis.segments).toEqual([[0, 1]]);
  });

  it('confond deux points séparés de moins d’un millimètre', () => {
    const axis = unfoldAxis([point(0, 0), point(0.0004, 0), point(10, 0)]);
    expect(axis.vertices.length).toBe(2);
  });

  /**
   * Un axe qui repasse par un point déjà posé s'y referme au lieu de s'y
   * dédoubler : sans cela le graphe se déconnecte sans qu'on le voie.
   */
  it('un axe en boucle se ferme sur son premier sommet', () => {
    const axis = unfoldAxis([point(0, 0), point(10, 0), point(10, 10), point(0, 0)]);
    expect(axis.vertices.length).toBe(3);
    expect(axis.segments).toEqual([[0, 1], [1, 2], [2, 0]]);
  });

  it('un axe d’un seul point ne produit aucune arête', () => {
    expect(unfoldAxis([point(0, 0)]).segments).toEqual([]);
  });

  it('un axe vide ne produit rien', () => {
    expect(unfoldAxis([])).toEqual({ vertices: [], segments: [] });
  });
});
