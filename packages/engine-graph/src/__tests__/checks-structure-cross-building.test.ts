import { describe, it, expect } from 'vitest';
import { crossBuildingWithoutLinkFindings } from '../checks-structure.js';
import { validateGraph } from '../validate-graph.js';
import { refBroken, refMinimal, refRetail } from '@azimut/testkit';
import type { SiteData } from '@azimut/core-model';

/**
 * M01.S10 — « Toute arête dont les deux extrémités appartiennent à des
 * bâtiments différents porte une ligne `building_link`. »
 *
 * N1.7 critère 3 veut, pour chaque cas, un site qui le déclenche et un site
 * voisin qui ne le déclenche pas. Les deux sont ici.
 */
describe('crossBuildingWithoutLinkFindings (M01.S10)', () => {
  /** Deux bâtiments, une arête qui les relie, et rien qui la déclare. */
  function twoBuildings(links: SiteData['graph']['building_links']): SiteData {
    return {
      ...refMinimal,
      buildings: [
        ...refMinimal.buildings,
        {
          id: 'bldg-002',
          org_id: 'org-test-001',
          site_id: refMinimal.site.id,
          name: 'Annexe',
          independent_access: true,
        },
      ],
      levels: [
        ...refMinimal.levels,
        {
          id: 'lvl-002',
          org_id: 'org-test-001',
          building_id: 'bldg-002',
          name: 'RDC Annexe',
          ordinal: 0,
          elevation_m: 0,
        },
      ],
      graph: {
        ...refMinimal.graph,
        nodes: [
          ...refMinimal.graph.nodes,
          {
            id: 'n-annexe',
            org_id: 'org-test-001',
            level_id: 'lvl-002',
            kind: 'junction' as const,
            position: { x_m: 50, y_m: 0 },
            label: 'Annexe',
          },
        ],
        edges: [
          ...refMinimal.graph.edges,
          {
            id: 'e-passerelle',
            org_id: 'org-test-001',
            from_node_id: 'n-junction',
            to_node_id: 'n-annexe',
            width_m: 2,
            slope_pct: 0,
            accessible: true,
            direction: 'both' as const,
            evacuation_route: false,
            length_m: 50,
          },
        ],
        building_links: links,
      },
    };
  }

  it('refuse une arête inter-bâtiments sans sa ligne', () => {
    const findings = crossBuildingWithoutLinkFindings(twoBuildings([]));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.code).toBe('GRAPH.BUILDING_LINK_MISSING');
    expect(findings[0]?.severity).toBe('blocking');
    expect(findings[0]?.entity).toEqual({ kind: 'edge', id: 'e-passerelle' });
    expect(findings[0]?.ruleRef).toBe('M01.S10');
    expect(findings[0]?.params).toMatchObject({
      from_building: 'bldg-001', to_building: 'bldg-002',
    });
  });

  /** Le contre-exemple : la même arête, avec sa ligne. */
  it('accepte la même arête quand sa ligne la déclare', () => {
    const site = twoBuildings([{
      id: 'bl-1',
      org_id: 'org-test-001',
      edge_id: 'e-passerelle',
      from_building_id: 'bldg-001',
      to_building_id: 'bldg-002',
      sheltered: false,
    }]);
    expect(crossBuildingWithoutLinkFindings(site)).toEqual([]);
  });

  it('ne dit rien d’une arête interne à un bâtiment', () => {
    expect(crossBuildingWithoutLinkFindings(refMinimal)).toEqual([]);
  });

  /**
   * Une extrémité dont le niveau est inconnu ne franchit aucune limite : c'est
   * un nœud orphelin, que `orphanNodeFindings` signale pour ce qu'il est.
   * Le dire deux fois dirait deux fois le même fait.
   */
  it('ne compte pas une extrémité de niveau inconnu', () => {
    const site = twoBuildings([]);
    const orphan: SiteData = {
      ...site,
      levels: refMinimal.levels,
    };
    expect(crossBuildingWithoutLinkFindings(orphan)).toEqual([]);
  });

  /** A9 : deux lectures d'un même site rendent la même liste. */
  it('ordonne ses anomalies par identifiant d’arête', () => {
    const site = twoBuildings([]);
    const twice: SiteData = {
      ...site,
      graph: {
        ...site.graph,
        edges: [
          ...site.graph.edges,
          {
            id: 'e-autre-passage',
            org_id: 'org-test-001',
            from_node_id: 'n-annexe',
            to_node_id: 'n-junction',
            width_m: 2,
            slope_pct: 0,
            accessible: true,
            direction: 'both' as const,
            evacuation_route: false,
            length_m: 50,
          },
        ],
      },
    };
    const ids = crossBuildingWithoutLinkFindings(twice).map(f => f.entity?.id ?? '');
    expect(ids).toEqual(['e-autre-passage', 'e-passerelle']);
  });

  /** Elle remonte jusqu'à `validateGraph`, sans quoi elle ne s'exécuterait pas. */
  it('remonte jusqu’à validateGraph', () => {
    const result = validateGraph(twoBuildings([]));
    const codes = (result.ok ? result.warnings : result.findings).map(f => f.code);
    expect(codes).toContain('GRAPH.BUILDING_LINK_MISSING');
  });

  /**
   * Le cas et son contre-exemple sur donnée de référence.
   *
   * Le site construit ci-dessus prouve le contrôle ; il ne prouve pas que le
   * dépôt porte une donnée où le cas se présente. C1 le demande : « Chaque cas
   * de détection de `validateGraph` dispose d'un site qui le déclenche et d'un
   * site voisin qui ne le déclenche pas. »
   */
  it('se lève sur ref-broken, qui porte l’arête sans sa ligne', () => {
    const findings = crossBuildingWithoutLinkFindings(refBroken);
    expect(findings.map(f => f.entity?.id)).toEqual(['e-brk-cross-building']);
    expect(findings[0]?.code).toBe('GRAPH.BUILDING_LINK_MISSING');
    expect(findings[0]?.severity).toBe('blocking');
    expect(findings[0]?.ruleRef).toBe('M01.S10');
  });

  it('se tait sur ref-retail, dont les deux passages portent la leur', () => {
    expect(crossBuildingWithoutLinkFindings(refRetail)).toEqual([]);
  });

  /**
   * Un site de référence qui n'est pas valide ne sert plus de point de
   * comparaison : le contre-exemple ne dirait plus « voici un site correct »,
   * mais « voici un site fautif ailleurs ».
   */
  it('ref-retail ne porte aucune anomalie bloquante', () => {
    const result = validateGraph(refRetail);
    const blocking = result.ok ? [] : result.findings.filter(f => f.severity === 'blocking');
    expect(blocking.map(f => `${f.code} ${f.entity?.id ?? ''}`)).toEqual([]);
  });
});
