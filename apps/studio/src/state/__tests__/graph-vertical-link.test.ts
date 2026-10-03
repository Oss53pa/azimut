import { describe, it, expect } from 'vitest';
import { acceptVerticalLink, CAPACITY_MIN } from '../graph-vertical-link.js';
import type { VerticalLinkDraft } from '../graph-vertical-link.js';
import { graphCommands } from '../graph-commands.js';

/**
 * T-1.5 — « Une arête entre deux niveaux sans liaison verticale associée est
 * refusée. » Le refus tient déjà dans `graph-input.test.ts` ; ce qui se prouve
 * ici est l'autre moitié : qu'il existe un geste qui produit l'arête *avec* sa
 * liaison, et qu'il refuse ce qui n'en est pas une.
 *
 * A5.3 : « Une arête entre deux niveaux différents doit avoir une ligne
 * `vertical_link`. »
 */

const BATIMENT = 'batiment-a';
const RDC = 'niveau-rdc';
const R1 = 'niveau-r1';

function draft(over: Partial<VerticalLinkDraft> = {}): VerticalLinkDraft {
  return {
    from: {
      nodeId: 'n-rdc',
      levelId: RDC,
      buildingId: BATIMENT,
      position: { x_m: 10, y_m: 4 },
      elevationM: 0,
    },
    to: {
      nodeId: 'n-r1',
      levelId: R1,
      buildingId: BATIMENT,
      position: { x_m: 10, y_m: 4 },
      elevationM: 3.2,
    },
    kind: 'elevator',
    accessible: true,
    capacity: 8,
    widthM: 1.4,
    direction: 'both',
    sheltered: false,
    ...over,
  };
}

describe('acceptVerticalLink (T-1.5, outil « Liaison verticale » de M4, partie M)', () => {
  it('rend l’arête et la liaison d’un seul tenant', () => {
    const outcome = acceptVerticalLink(draft());
    if (!outcome.ok) throw new Error(outcome.findings.map(f => f.code).join(', '));

    expect(outcome.value.kind).toBe('elevator');
    expect(outcome.value.accessible).toBe(true);
    expect(outcome.value.capacity).toBe(8);
    expect(outcome.value.edge.fromNodeId).toBe('n-rdc');
    expect(outcome.value.edge.toNodeId).toBe('n-r1');
  });

  /**
   * Le point qui rendait l'outil impossible avec un seul niveau : deux nœuds
   * à l'aplomb l'un de l'autre sont à distance nulle *dans le plan*. La
   * longueur est tridimensionnelle, et c'est l'altitude du niveau qui la
   * porte. Posés tous deux à l'altitude zéro, ils seraient refusés pour
   * longueur nulle — alors que c'est l'alignement même que QC-12 attend.
   */
  it('tire la longueur de la dénivelée, et non du plan', () => {
    const outcome = acceptVerticalLink(draft());
    if (!outcome.ok) throw new Error('refusé');
    expect(outcome.value.edge.lengthM).toBeCloseTo(3.2, 3);
  });

  it('refuse deux nœuds d’un même niveau', () => {
    const outcome = acceptVerticalLink(draft({
      to: {
        nodeId: 'n-autre', levelId: RDC, buildingId: BATIMENT,
        position: { x_m: 20, y_m: 4 }, elevationM: 0,
      },
    }));
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.findings.map(f => f.code)).toContain('GRAPH.VERTICAL_LINK_SAME_LEVEL');
  });

  it('refuse une arête sur elle-même, par le contrôle de l’arête', () => {
    const outcome = acceptVerticalLink(draft({
      to: {
        nodeId: 'n-rdc', levelId: R1, buildingId: BATIMENT,
        position: { x_m: 10, y_m: 4 }, elevationM: 3.2,
      },
    }));
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.findings.map(f => f.code)).toContain('GRAPH.EDGE_SELF_LOOP');
  });

  /**
   * A5.3 et migration 0004 : `capacity integer NOT NULL DEFAULT 1`. Une
   * capacité absente n'est pas représentable, et l'écran propose le défaut de
   * la colonne plutôt qu'une valeur choisie dans le code.
   */
  it('porte la capacité telle qu’elle est donnée, jusqu’au défaut de la colonne', () => {
    const outcome = acceptVerticalLink(draft({ kind: 'stair', capacity: 1 }));
    if (!outcome.ok) throw new Error('refusé');
    expect(outcome.value.capacity).toBe(1);
  });

  it('refuse une capacité non entière ou sous un', () => {
    for (const capacity of [0, -3, 2.5]) {
      const outcome = acceptVerticalLink(draft({ capacity }));
      expect(outcome.ok, `capacité ${String(capacity)}`).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.findings.map(f => f.code)).toContain('DATA.CAPACITY_INVALID');
    }
    expect(CAPACITY_MIN).toBe(1);
  });

  /**
   * M01.S10 — une passerelle entre deux bâtiments est à la fois une liaison
   * verticale et une liaison inter-bâtiments. C'est le seul geste de l'atelier
   * qui puisse produire une arête franchissant une limite de bâtiment, et la
   * règle exige alors la ligne.
   */
  it('produit la liaison inter-bâtiments quand l’arête franchit une limite', () => {
    const outcome = acceptVerticalLink(draft({
      to: {
        nodeId: 'n-r1', levelId: R1, buildingId: 'batiment-b',
        position: { x_m: 10, y_m: 4 }, elevationM: 3.2,
      },
      sheltered: true,
    }));
    if (!outcome.ok) throw new Error(outcome.findings.map(f => f.code).join(', '));
    expect(outcome.value.buildingLink).toEqual({
      fromBuildingId: 'batiment-a',
      toBuildingId: 'batiment-b',
      sheltered: true,
    });
  });

  /** Le contre-exemple : un escalier interne n'en produit aucune. */
  it('n’en produit aucune à l’intérieur d’un bâtiment', () => {
    const outcome = acceptVerticalLink(draft({ sheltered: true }));
    if (!outcome.ok) throw new Error('refusé');
    expect(outcome.value.buildingLink).toBeNull();
  });

  it('écrit l’arête, sa liaison verticale et sa liaison inter-bâtiments en un groupe', () => {
    const outcome = acceptVerticalLink(draft({
      to: {
        nodeId: 'n-r1', levelId: R1, buildingId: 'batiment-b',
        position: { x_m: 10, y_m: 4 }, elevationM: 3.2,
      },
    }));
    if (!outcome.ok) throw new Error('refusé');
    const link = outcome.value.buildingLink;
    if (link === null) throw new Error('liaison inter-bâtiments attendue');

    const commands = graphCommands(
      [],
      [{ id: 'e-1', edge: outcome.value.edge }],
      [{
        id: 'vl-1', edgeId: 'e-1', kind: outcome.value.kind,
        accessible: outcome.value.accessible, capacity: outcome.value.capacity,
      }],
      { orgId: 'org-1', levelId: RDC, timestamp: '2026-01-01T00:00:00.000Z' },
      'vertical-link:e-1',
      [{
        id: 'bl-1', edgeId: 'e-1',
        fromBuildingId: link.fromBuildingId,
        toBuildingId: link.toBuildingId,
        sheltered: link.sheltered,
      }],
    );
    if (!commands.ok) throw new Error('commandes refusées');

    // L'ordre suit les dépendances : l'arête, puis les deux liaisons qui la
    // citent. Le magasin annule en ordre inverse, ce qui ne heurte aucune clé.
    expect(commands.value.map(c => c.table)).toEqual(['edge', 'vertical_link', 'building_link']);
    expect(new Set(commands.value.map(c => c.groupKey)).size).toBe(1);
    expect(commands.value[2]?.after?.['edge_id']).toBe('e-1');
    expect(commands.value[2]?.after?.['sheltered']).toBe(false);
  });

  /**
   * Les deux écritures vont ensemble. Les séparer laisserait, entre les deux
   * commandes, un état que la validation refuse — et qu'une annulation
   * partielle pourrait figer.
   */
  it('s’écrit en un seul groupe, l’arête avant la liaison', () => {
    const outcome = acceptVerticalLink(draft());
    if (!outcome.ok) throw new Error('refusé');

    const commands = graphCommands(
      [],
      [{ id: 'e-1', edge: outcome.value.edge }],
      [{
        id: 'vl-1',
        edgeId: 'e-1',
        kind: outcome.value.kind,
        accessible: outcome.value.accessible,
        capacity: outcome.value.capacity,
      }],
      { orgId: 'org-1', levelId: RDC, timestamp: '2026-01-01T00:00:00.000Z' },
      'vertical-link:e-1',
    );
    if (!commands.ok) throw new Error('commandes refusées');

    expect(commands.value.map(c => c.table)).toEqual(['edge', 'vertical_link']);
    expect(new Set(commands.value.map(c => c.groupKey)).size).toBe(1);
    expect(commands.value[1]?.after?.['edge_id']).toBe('e-1');
  });
});
