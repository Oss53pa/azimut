import { describe, it, expect } from 'vitest';
import {
  destinationNotReachedFromEveryEntranceFindings,
} from '../checks-structure.js';
import { validateGraph } from '../validate-graph.js';
import { refMultilevel } from '@azimut/testkit';
import type { SiteData, EdgeDirection, GraphNode } from '@azimut/core-model';

/** Donne un sens à une arête nommée. */
function oriente(site: SiteData, edgeId: string, direction: EdgeDirection): SiteData {
  return {
    ...site,
    graph: {
      ...site.graph,
      edges: site.graph.edges.map(e => (e.id === edgeId ? { ...e, direction } : e)),
    },
  };
}

/** Ajoute une seconde entrée, reliée au hall du rez-de-chaussée. */
function deuxEntrees(site: SiteData): SiteData {
  const premiere = site.graph.nodes.find(n => n.kind === 'entrance');
  if (premiere === undefined) throw new Error('le site de référence n’a pas d’entrée');
  const seconde: GraphNode = {
    ...premiere,
    id: 'n-ml-entrance-sud',
    label: 'Entrée sud',
    position: { x_m: premiere.position.x_m + 30, y_m: premiere.position.y_m },
  };
  return {
    ...site,
    graph: {
      ...site.graph,
      nodes: [...site.graph.nodes, seconde],
      edges: [...site.graph.edges, {
        id: 'e-ml-entrance-sud-hall',
        org_id: 'org-test-001',
        from_node_id: seconde.id,
        to_node_id: 'n-ml-hall',
        width_m: 2.4,
        slope_pct: 0,
        accessible: true,
        direction: 'both' as const,
        evacuation_route: false,
        length_m: 30,
      }],
    },
  };
}

describe('QC-10 (complément atelier) — toutes les entrées desservent-elles tout', () => {
  it('ne signale rien sur le site de référence', () => {
    expect(destinationNotReachedFromEveryEntranceFindings(refMultilevel)).toHaveLength(0);
  });

  it('ne signale rien quand deux entrées desservent tout', () => {
    expect(destinationNotReachedFromEveryEntranceFindings(deuxEntrees(refMultilevel))).toHaveLength(0);
  });

  it('voit le sens unique qui coupe une entrée d’une destination', () => {
    // L'arête va du hall vers l'entrée seulement : depuis l'entrée sud, on
    // n'atteint plus rien. C'est le cas que le contrôle existant ne voit pas —
    // l'aile reste reliée au sens du modèle, et il ne lit pas `direction`.
    const site = oriente(deuxEntrees(refMultilevel), 'e-ml-entrance-sud-hall', 'backward');
    const findings = destinationNotReachedFromEveryEntranceFindings(site);
    expect(findings).toHaveLength(2);
    expect(findings[0]?.code).toBe('GRAPH.DESTINATION_ENTRANCE_COVERAGE');
    expect(findings[0]?.severity).toBe('blocking');
    expect(findings[0]?.params['reached_from']).toBe(1);
    expect(findings[0]?.params['entrances_total']).toBe(2);
    expect(findings[0]?.params['unreached_entrance_ids']).toBe('n-ml-entrance-sud');
    expect(findings[0]?.ruleRef).toBe('atelier-QC-10');
  });

  it('le contrôle de structure, lui, reste muet sur ce sens unique', () => {
    // La preuve que QC-10 apporte quelque chose : `validateGraph` sans lui
    // n'avait aucune anomalie à dire sur ce graphe, parce que le sens unique
    // ne rompt pas la connexité du modèle.
    const site = oriente(deuxEntrees(refMultilevel), 'e-ml-entrance-sud-hall', 'backward');
    const result = validateGraph(site);
    const findings = result.ok ? (result.warnings ?? []) : result.findings;
    const autres = findings.filter(f => f.code !== 'GRAPH.DESTINATION_ENTRANCE_COVERAGE');
    expect(autres.map(f => f.code)).not.toContain('GRAPH.DESTINATION_UNREACHABLE');
    expect(autres.map(f => f.code)).not.toContain('GRAPH.DISCONNECTED');
    expect(autres.map(f => f.code)).not.toContain('GRAPH.ZONE_UNREACHABLE');
  });

  it('laisse passer un sens unique qui ne coupe personne', () => {
    // L'entrée principale va vers le hall dans le bon sens : rien à dire.
    const site = oriente(deuxEntrees(refMultilevel), 'e-ml-entrance-sud-hall', 'forward');
    expect(destinationNotReachedFromEveryEntranceFindings(site)).toHaveLength(0);
  });

  it('une anomalie par destination, pas une par couple entrée-destination', () => {
    // Une aile coupée est un défaut, pas cinq. Les entrées en défaut sont
    // nommées dans les paramètres plutôt que multipliées en anomalies.
    const site = oriente(deuxEntrees(refMultilevel), 'e-ml-entrance-sud-hall', 'backward');
    const findings = destinationNotReachedFromEveryEntranceFindings(site);
    expect(findings).toHaveLength(site.destinations.length);
    expect(new Set(findings.map(f => f.entity?.id)).size).toBe(findings.length);
  });

  it('se tait quand le graphe n’a aucune entrée, que GRAPH.NO_ENTRANCE dit déjà', () => {
    const site: SiteData = {
      ...refMultilevel,
      graph: {
        ...refMultilevel.graph,
        nodes: refMultilevel.graph.nodes.filter(n => n.kind !== 'entrance'),
      },
    };
    expect(destinationNotReachedFromEveryEntranceFindings(site)).toHaveLength(0);
  });

  it('remonte jusqu’à validateGraph', () => {
    const site = oriente(deuxEntrees(refMultilevel), 'e-ml-entrance-sud-hall', 'backward');
    const result = validateGraph(site);
    const findings = result.ok ? (result.warnings ?? []) : result.findings;
    expect(findings.map(f => f.code)).toContain('GRAPH.DESTINATION_ENTRANCE_COVERAGE');
  });
});
