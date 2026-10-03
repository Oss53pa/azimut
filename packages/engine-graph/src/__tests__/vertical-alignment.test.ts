import { describe, it, expect } from 'vitest';
import { verticalLinkMisalignedFindings } from '../checks-structure.js';
import { validateGraph } from '../validate-graph.js';
import { refMultilevel } from '@azimut/testkit';
import type { SiteData, VerticalLinkKind } from '@azimut/core-model';

/**
 * Déplace le nœud haut d'une liaison verticale de `dx` mètres, et lui donne
 * éventuellement une autre nature.
 */
function decale(dx: number, kind?: VerticalLinkKind): SiteData {
  const link = refMultilevel.graph.vertical_links[0];
  if (link === undefined) throw new Error('le site de référence n’a aucune liaison verticale');
  const edge = refMultilevel.graph.edges.find(e => e.id === link.edge_id);
  if (edge === undefined) throw new Error('arête de la liaison introuvable');

  return {
    ...refMultilevel,
    graph: {
      ...refMultilevel.graph,
      nodes: refMultilevel.graph.nodes.map(n =>
        n.id === edge.to_node_id
          ? { ...n, position: { ...n.position, x_m: n.position.x_m + dx } }
          : n),
      vertical_links: refMultilevel.graph.vertical_links.map(v =>
        v.id === link.id && kind !== undefined ? { ...v, kind } : v),
    },
  };
}

describe('GRAPH.VERTICAL_LINK_MISALIGNED — liaison verticale décalée', () => {
  it('ne signale rien sur le site de référence, dont les liaisons coïncident', () => {
    // Sans cette vérification, un contrôle en panne aurait l'air vertueux.
    expect(verticalLinkMisalignedFindings(refMultilevel)).toHaveLength(0);
  });

  it('signale un ascenseur qui ne ressort pas au même endroit', () => {
    // D2.2 : la liaison occupe le même point sur les deux
    // niveaux. Sinon le plan du niveau supérieur place la sortie ailleurs
    // qu'elle n'est, et rien ne le voyait.
    const findings = verticalLinkMisalignedFindings(decale(2.5));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.code).toBe('GRAPH.VERTICAL_LINK_MISALIGNED');
    expect(findings[0]?.severity).toBe('blocking');
    expect(findings[0]?.entity?.kind).toBe('vertical_link');
    expect(findings[0]?.params['offset_mm']).toBe(2500);
    expect(findings[0]?.ruleRef).toBe('D1.5');
  });

  it('admet l’écart que D1.5 appelle « le même point »', () => {
    // POINT_COINCIDENCE_M vaut un millimètre. Le seuil n'est pas posé ici :
    // « Non alignée » se mesure : D1.5 dit à partir de
    // quand deux points n'en sont plus qu'un.
    expect(verticalLinkMisalignedFindings(decale(0.0009))).toHaveLength(0);
    expect(verticalLinkMisalignedFindings(decale(0.0011))).toHaveLength(1);
  });

  it('laisse tranquilles l’escalier mécanique et la rampe, même décalés', () => {
    // L'un comme l'autre gagne sa hauteur en avançant : ses extrémités ne
    // peuvent pas coïncider, et les retenir produirait une anomalie bloquante
    // sur une géométrie correcte — sur toute rampe réelle, d'ailleurs, la
    // coïncidence n'étant tenable que par ce qui occupe une gaine verticale.
    expect(verticalLinkMisalignedFindings(decale(8, 'escalator'))).toHaveLength(0);
    expect(verticalLinkMisalignedFindings(decale(8, 'ramp'))).toHaveLength(0);
  });

  /**
   * D2.2 nomme les natures visées, le contrôle en retient
   * deux : celles qui occupent une gaine verticale, et pour lesquelles la
   * coïncidence est le fait à vérifier.
   */
  it('retient l’ascenseur et l’escalier', () => {
    for (const kind of ['elevator', 'stair'] as const) {
      const findings = verticalLinkMisalignedFindings(decale(3, kind));
      expect(findings, kind).toHaveLength(1);
      expect(findings[0]?.params['kind']).toBe(kind);
    }
  });

  it('ignore une liaison dont les deux nœuds sont sur le même niveau', () => {
    // Il n'y a rien à aligner entre un niveau et lui-même ; le cas inverse,
    // une arête entre niveaux sans liaison, est celui de VERTICAL_LINK_MISSING.
    const link = refMultilevel.graph.vertical_links[0];
    if (link === undefined) throw new Error('aucune liaison verticale');
    const edge = refMultilevel.graph.edges.find(e => e.id === link.edge_id);
    if (edge === undefined) throw new Error('arête introuvable');
    const base = decale(5);
    const site: SiteData = {
      ...base,
      graph: {
        ...base.graph,
        nodes: base.graph.nodes.map(n =>
          n.id === edge.to_node_id ? { ...n, level_id: 'lvl-ml-rdc' } : n),
      },
    };
    expect(verticalLinkMisalignedFindings(site)).toHaveLength(0);
  });

  it('ne tombe pas sur une liaison dont l’arête a disparu', () => {
    const site: SiteData = {
      ...refMultilevel,
      graph: { ...refMultilevel.graph, edges: [] },
    };
    expect(() => verticalLinkMisalignedFindings(site)).not.toThrow();
    expect(verticalLinkMisalignedFindings(site)).toHaveLength(0);
  });

  it('remonte jusqu’à validateGraph', () => {
    const result = validateGraph(decale(4));
    const findings = result.ok ? (result.warnings ?? []) : result.findings;
    expect(findings.map(f => f.code)).toContain('GRAPH.VERTICAL_LINK_MISALIGNED');
  });
});
