import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit';
import type { GraphNode, SiteData } from '@azimut/core-model';
import {
  landmarkNodes,
  buildControlPairs,
  evaluateMeasuredCalibration,
  LANDMARK_NODE_KINDS,
  type PairDraft,
} from '../measured-calibration.js';

const RDC = 'lvl-ml-rdc';

/** Fond fictif : 10 pixels par mètre, axe vertical inversé comme à l'écran. */
function toPixels(x_m: number, y_m: number): { x_px: number; y_px: number } {
  return { x_px: 100 + 10 * x_m, y_px: 300 - 10 * y_m };
}

/** Un brouillon posé exactement à l'aplomb de son amer. */
function exactDraft(site: SiteData, nodeId: string): PairDraft {
  const node = site.graph.nodes.find((n) => n.id === nodeId);
  if (node === undefined) throw new Error(`nœud absent : ${nodeId}`);
  return { node_id: nodeId, source: toPixels(node.position.x_m, node.position.y_m) };
}

/** refMultilevel n'a que trois amers au rez-de-chaussée ; en voici un quatrième. */
function withExtraLandmark(): SiteData {
  const extra: GraphNode = {
    id: 'n-ml-exit-rdc',
    org_id: 'org-test-001',
    level_id: RDC,
    kind: 'emergency_exit',
    position: { x_m: 5, y_m: 25 },
    label: 'Issue de secours',
  };
  return {
    ...refMultilevel,
    graph: { ...refMultilevel.graph, nodes: [...refMultilevel.graph.nodes, extra] },
  };
}

describe('landmarkNodes', () => {
  it('ne retient que les natures que l’on montre du doigt sur un plan', () => {
    const nodes = landmarkNodes(refMultilevel, RDC);
    expect(nodes.map((n) => n.id)).toEqual([
      'n-ml-elevator-rdc',
      'n-ml-entrance',
      'n-ml-stair-rdc',
    ]);
    for (const node of nodes) {
      expect(LANDMARK_NODE_KINDS).toContain(node.kind);
    }
  });

  it('écarte le croisement et l’accès de destination, qui n’ont pas d’existence bâtie', () => {
    const ids = landmarkNodes(refMultilevel, RDC).map((n) => n.id);
    expect(ids).not.toContain('n-ml-hall');
    expect(ids).not.toContain('n-ml-dest-rdc');
  });

  it('ne retient que le niveau demandé', () => {
    const ids = landmarkNodes(refMultilevel, 'lvl-ml-r1').map((n) => n.id);
    expect(ids).toEqual(['n-ml-elevator-r1', 'n-ml-stair-r1']);
  });
});

describe('buildControlPairs', () => {
  it('prend la position de l’amer comme cible, jamais une saisie', () => {
    const pairs = buildControlPairs(refMultilevel, [exactDraft(refMultilevel, 'n-ml-entrance')]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.target).toEqual({ x_m: 20, y_m: 0 });
    expect(pairs[0]?.id).toBe('n-ml-entrance');
  });

  it('écarte sans bruit un amer disparu du graphe', () => {
    const pairs = buildControlPairs(refMultilevel, [
      exactDraft(refMultilevel, 'n-ml-entrance'),
      { node_id: 'n-supprimé', source: { x_px: 1, y_px: 2 } },
    ]);
    expect(pairs.map((p) => p.id)).toEqual(['n-ml-entrance']);
  });
});

describe('evaluateMeasuredCalibration', () => {
  const tolerance = { mean_m: 0.1, point_m: 0.2 };

  it('compte les amers manquants sans crier à l’erreur', () => {
    const state = evaluateMeasuredCalibration(
      refMultilevel,
      [exactDraft(refMultilevel, 'n-ml-entrance')],
      tolerance,
    );
    expect(state.calibration).toBeNull();
    expect(state.missing_pairs).toBe(2);
    // Une saisie en cours n'est pas une saisie fautive.
    expect(state.findings).toEqual([]);
  });

  it('ajuste dès trois amers, en avertissant que le résidu ne mesure rien', () => {
    const state = evaluateMeasuredCalibration(
      refMultilevel,
      [
        exactDraft(refMultilevel, 'n-ml-entrance'),
        exactDraft(refMultilevel, 'n-ml-elevator-rdc'),
        exactDraft(refMultilevel, 'n-ml-stair-rdc'),
      ],
      tolerance,
    );
    expect(state.calibration).not.toBeNull();
    expect(state.missing_pairs).toBe(0);
    expect(state.findings.map((f) => f.code)).toContain('CALIB.RESIDUAL_NOT_MEASURED');
  });

  it('retrouve le fond fictif quand les amers sont posés juste', () => {
    const site = withExtraLandmark();
    const state = evaluateMeasuredCalibration(
      site,
      landmarkNodes(site, RDC).map((n) => exactDraft(site, n.id)),
      tolerance,
    );
    expect(state.calibration?.mean_residual_m).toBeLessThan(1e-9);
    expect(state.findings).toEqual([]);
  });

  it('rend le verdict quand un amer est posé de travers', () => {
    const site = withExtraLandmark();
    const drafts = landmarkNodes(site, RDC).map((n) => exactDraft(site, n.id));
    const off = drafts.map((draft, i) =>
      i === 0 ? { ...draft, source: { x_px: draft.source.x_px + 90, y_px: draft.source.y_px } } : draft,
    );

    const state = evaluateMeasuredCalibration(site, off, tolerance);
    expect(state.findings.map((f) => f.code)).toContain('CALIB.RESIDUAL_MEAN_EXCEEDED');
  });

  it('sans tolérance déclarée, calcule les résidus et ne juge pas', () => {
    const site = withExtraLandmark();
    const drafts = landmarkNodes(site, RDC).map((n) => exactDraft(site, n.id));
    const off = drafts.map((draft, i) =>
      i === 0 ? { ...draft, source: { x_px: draft.source.x_px + 90, y_px: draft.source.y_px } } : draft,
    );

    const state = evaluateMeasuredCalibration(site, off, null);
    expect(state.unjudged).toBe(true);
    expect(state.calibration?.mean_residual_m).toBeGreaterThan(0);
    expect(state.findings.map((f) => f.code)).not.toContain('CALIB.RESIDUAL_MEAN_EXCEEDED');
  });
});
