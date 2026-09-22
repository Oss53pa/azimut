import { describe, it, expect } from 'vitest';
import { refMinimal, refMultilevel } from '@azimut/testkit';
import type { SiteData, Finding } from '@azimut/core-model';
import { validateGraph } from '../validate-graph.js';
import { auditCoverage } from '../audit.js';

/**
 * N1.7, critère 3 : « `validateGraph` détecte chacun de ses cas sur un site de
 * référence dédié, et ne le détecte pas sur le site voisin. »
 *
 * C1 dit pourquoi le contre-exemple compte : « Un test de détection sans son
 * contre-exemple est incomplet. » Une détection qui se déclenche partout ne
 * vaut rien, et rien ne le révèle tant qu'on ne vérifie que le déclenchement.
 *
 * Chaque cas est donc une paire : un site obtenu par une seule altération du
 * site voisin, et le site voisin lui-même. Une altération unique, parce qu'une
 * altération double laisserait planer le doute sur ce qui a déclenché quoi.
 */

function codesOf(site: SiteData): readonly string[] {
  const outcome = validateGraph(site);
  const findings: readonly Finding[] = outcome.ok ? outcome.warnings : outcome.findings;
  return findings.map(f => f.code);
}

/** Une paire : ce qui déclenche, et le voisin qui ne déclenche pas. */
type Pair = {
  readonly code: string;
  readonly neighbour: SiteData;
  readonly triggering: SiteData;
};

const MINIMAL_ORG = 'org-test-001';
const MINIMAL_LEVEL = 'lvl-001';

function withGraph(site: SiteData, graph: Partial<SiteData['graph']>): SiteData {
  return { ...site, graph: { ...site.graph, ...graph } };
}

const ISLAND_NODE = {
  id: 'n-ile', org_id: MINIMAL_ORG, level_id: MINIMAL_LEVEL,
  kind: 'junction' as const, position: { x_m: 900, y_m: 900 }, label: 'Île',
};

const PAIRS: readonly Pair[] = [
  {
    code: 'GRAPH.NODE_ORPHAN',
    neighbour: refMinimal,
    triggering: withGraph(refMinimal, { nodes: [...refMinimal.graph.nodes, ISLAND_NODE] }),
  },
  {
    code: 'GRAPH.EDGE_SELF_LOOP',
    neighbour: refMinimal,
    triggering: withGraph(refMinimal, {
      edges: [...refMinimal.graph.edges, {
        id: 'e-boucle', org_id: MINIMAL_ORG,
        from_node_id: 'n-junction', to_node_id: 'n-junction',
        width_m: 2, slope_pct: 0, accessible: true, direction: 'both' as const,
        evacuation_route: false, length_m: 5,
      }],
    }),
  },
  {
    code: 'GRAPH.EDGE_ZERO_LENGTH',
    neighbour: refMinimal,
    triggering: withGraph(refMinimal, {
      edges: refMinimal.graph.edges.map(e => (e.id === 'e-02' ? { ...e, length_m: 0 } : e)),
    }),
  },
  {
    code: 'GRAPH.DISCONNECTED',
    neighbour: refMinimal,
    triggering: withGraph(refMinimal, {
      nodes: [...refMinimal.graph.nodes, ISLAND_NODE, {
        ...ISLAND_NODE, id: 'n-ile-2', position: { x_m: 910, y_m: 900 },
      }],
      edges: [...refMinimal.graph.edges, {
        id: 'e-ile', org_id: MINIMAL_ORG,
        from_node_id: 'n-ile', to_node_id: 'n-ile-2',
        width_m: 2, slope_pct: 0, accessible: true, direction: 'both' as const,
        evacuation_route: false, length_m: 10,
      }],
    }),
  },
  {
    code: 'GRAPH.DESTINATION_UNLINKED',
    neighbour: refMinimal,
    triggering: {
      ...refMinimal,
      destinations: refMinimal.destinations.map((d, i) =>
        (i === 0 ? { ...d, node_id: 'n-inexistant' } : d)),
    },
  },
];

describe('N1.7 critère 3 — chaque cas a son site et son contre-exemple', () => {
  it('le site voisin de référence ne déclenche rien de bloquant', () => {
    const outcome = validateGraph(refMinimal);
    expect(outcome.ok, `ref-minimal doit passer : ${codesOf(refMinimal).join(', ')}`).toBe(true);
  });

  for (const pair of PAIRS) {
    describe(pair.code, () => {
      it('se déclenche sur le site altéré', () => {
        expect(codesOf(pair.triggering)).toContain(pair.code);
      });

      it('ne se déclenche pas sur le site voisin', () => {
        expect(codesOf(pair.neighbour)).not.toContain(pair.code);
      });
    });
  }
});

describe('N1.7 critère 3 — les cas multiniveaux', () => {
  it('le site multiniveau de référence ne déclenche rien de bloquant', () => {
    const outcome = validateGraph(refMultilevel);
    expect(
      outcome.ok,
      `ref-multilevel doit passer : ${codesOf(refMultilevel).join(', ')}`,
    ).toBe(true);
  });

  it('GRAPH.VERTICAL_LINK_MISSING se déclenche quand la liaison disparaît', () => {
    const without = withGraph(refMultilevel, { vertical_links: [] });
    expect(codesOf(without)).toContain('GRAPH.VERTICAL_LINK_MISSING');
  });

  it('GRAPH.VERTICAL_LINK_MISSING ne se déclenche pas sur le site voisin', () => {
    expect(codesOf(refMultilevel)).not.toContain('GRAPH.VERTICAL_LINK_MISSING');
  });

  it('GRAPH.LEVEL_NO_ACCESSIBLE_LINK se déclenche quand aucune liaison ne l’est', () => {
    const inaccessible = withGraph(refMultilevel, {
      vertical_links: refMultilevel.graph.vertical_links.map(v => ({ ...v, accessible: false })),
    });
    expect(codesOf(inaccessible)).toContain('GRAPH.LEVEL_NO_ACCESSIBLE_LINK');
  });

  it('GRAPH.LEVEL_NO_ACCESSIBLE_LINK ne se déclenche pas sur le site voisin', () => {
    expect(codesOf(refMultilevel)).not.toContain('GRAPH.LEVEL_NO_ACCESSIBLE_LINK');
  });
});

describe('N1.7 critère 3 — l’audit refuse de chiffrer un graphe non validé', () => {
  /**
   * A7.1 : « `auditCoverage` refuse de produire un taux si `validateGraph`
   * n'est pas passé. » C'est le seul cas du catalogue que `validateGraph` ne
   * lève pas lui-même, puisqu'il porte sur ce qui vient après lui.
   */
  it('GRAPH.NOT_VALIDATED se déclenche sur un graphe en défaut', () => {
    const broken = withGraph(refMinimal, {
      edges: refMinimal.graph.edges.map(e => (e.id === 'e-02' ? { ...e, length_m: 0 } : e)),
    });
    const profile = broken.travel_profiles[0];
    expect(profile, 'ref-minimal doit porter un profil').toBeDefined();
    if (profile === undefined) return;
    const outcome = auditCoverage(broken, profile, []);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.findings.map(f => f.code)).toContain('GRAPH.NOT_VALIDATED');
  });

  it('ne se déclenche pas sur le site voisin, dont le graphe passe', () => {
    const profile = refMinimal.travel_profiles[0];
    if (profile === undefined) throw new Error('ref-minimal doit porter un profil');
    const outcome = auditCoverage(refMinimal, profile, []);
    const codes = outcome.ok ? outcome.warnings.map(f => f.code) : outcome.findings.map(f => f.code);
    expect(codes).not.toContain('GRAPH.NOT_VALIDATED');
  });
});
