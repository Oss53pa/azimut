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

/**
 * Ajoute une seconde entrée, son vestibule, et relie le vestibule au hall.
 *
 * Deux arêtes et non une : la portée du contrôle ne retient que les entrées
 * qu'au moins un profil peut emprunter, et « emprunter » se lit sur l'arête qui
 * part de l'entrée. Couper l'entrée du site en orientant sa propre arête la
 * ferait sortir de la portée au lieu de produire l'anomalie. Le vestibule
 * sépare les deux faits : on entre par la porte sud, et c'est la suite du
 * cheminement qui coupe ou non l'annuaire.
 */
function deuxEntrees(site: SiteData): SiteData {
  const premiere = site.graph.nodes.find(n => n.kind === 'entrance');
  if (premiere === undefined) throw new Error('le site de référence n’a pas d’entrée');
  const seconde: GraphNode = {
    ...premiere,
    id: 'n-ml-entrance-sud',
    label: 'Entrée sud',
    position: { x_m: 50, y_m: -10 },
  };
  const vestibule: GraphNode = {
    ...premiere,
    id: 'n-ml-vestibule-sud',
    kind: 'junction',
    label: 'Vestibule sud',
    position: { x_m: 50, y_m: 0 },
  };
  return {
    ...site,
    graph: {
      ...site.graph,
      nodes: [...site.graph.nodes, seconde, vestibule],
      edges: [...site.graph.edges,
        arete('e-ml-entrance-sud-vestibule', seconde.id, vestibule.id, 10),
        arete('e-ml-vestibule-sud-hall', vestibule.id, 'n-ml-hall', 31.623),
      ],
    },
  };
}

function arete(id: string, from: string, to: string, lengthM: number) {
  return {
    id,
    org_id: 'org-test-001',
    from_node_id: from,
    to_node_id: to,
    width_m: 2.4,
    slope_pct: 0,
    accessible: true,
    direction: 'both' as const,
    evacuation_route: false,
    length_m: lengthM,
  };
}

/** Le site sans aucun profil de parcours. */
function sansProfil(site: SiteData): SiteData {
  return { ...site, travel_profiles: [] };
}

describe('GRAPH.DESTINATION_ENTRANCE_COVERAGE — toutes les entrées desservent-elles tout', () => {
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
    const site = oriente(deuxEntrees(refMultilevel), 'e-ml-vestibule-sud-hall', 'backward');
    const findings = destinationNotReachedFromEveryEntranceFindings(site);
    expect(findings).toHaveLength(2);
    expect(findings[0]?.code).toBe('GRAPH.DESTINATION_ENTRANCE_COVERAGE');
    // Tranché par l'éditeur : avertissement, non refus. Une desserte
    // partielle est un défaut de jalonnement à examiner, pas une donnée
    // impossible.
    expect(findings[0]?.severity).toBe('warning');
    expect(findings[0]?.params['reached_from']).toBe(1);
    expect(findings[0]?.params['entrances_total']).toBe(2);
    expect(findings[0]?.params['unreached_entrance_ids']).toBe('n-ml-entrance-sud');
    expect(findings[0]?.ruleRef).toBeNull();
  });

  it('le contrôle de structure, lui, reste muet sur ce sens unique', () => {
    // La preuve que QC-10 apporte quelque chose : `validateGraph` sans lui
    // n'avait aucune anomalie à dire sur ce graphe, parce que le sens unique
    // ne rompt pas la connexité du modèle.
    const site = oriente(deuxEntrees(refMultilevel), 'e-ml-vestibule-sud-hall', 'backward');
    const result = validateGraph(site);
    const findings = result.ok ? (result.warnings ?? []) : result.findings;
    const autres = findings.filter(f => f.code !== 'GRAPH.DESTINATION_ENTRANCE_COVERAGE');
    expect(autres.map(f => f.code)).not.toContain('GRAPH.DESTINATION_UNREACHABLE');
    expect(autres.map(f => f.code)).not.toContain('GRAPH.DISCONNECTED');
    expect(autres.map(f => f.code)).not.toContain('GRAPH.ZONE_UNREACHABLE');
  });

  it('laisse passer un sens unique qui ne coupe personne', () => {
    // L'entrée principale va vers le hall dans le bon sens : rien à dire.
    const site = oriente(deuxEntrees(refMultilevel), 'e-ml-vestibule-sud-hall', 'forward');
    expect(destinationNotReachedFromEveryEntranceFindings(site)).toHaveLength(0);
  });

  it('une anomalie par destination, pas une par couple entrée-destination', () => {
    // Une aile coupée est un défaut, pas cinq. Les entrées en défaut sont
    // nommées dans les paramètres plutôt que multipliées en anomalies.
    const site = oriente(deuxEntrees(refMultilevel), 'e-ml-vestibule-sud-hall', 'backward');
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

  it('se tait sur une destination dont le nœud n’existe pas', () => {
    // Elle n'est pas mal desservie, elle est mal rattachée, et
    // GRAPH.DESTINATION_UNLINKED le dit déjà dans validateDirectory. La
    // signaler ici donnerait au lecteur une cause fausse : il chercherait un
    // problème de cheminement là où la référence est rompue.
    const premiere = refMultilevel.destinations[0];
    if (premiere === undefined) throw new Error('aucune destination de référence');
    const site: SiteData = {
      ...refMultilevel,
      destinations: [{ ...premiere, node_id: 'n-ml-inexistant' }],
    };
    expect(destinationNotReachedFromEveryEntranceFindings(site)).toHaveLength(0);
  });

  it('remonte jusqu’à validateGraph', () => {
    const site = oriente(deuxEntrees(refMultilevel), 'e-ml-vestibule-sud-hall', 'backward');
    const result = validateGraph(site);
    const findings = result.ok ? (result.warnings ?? []) : result.findings;
    expect(findings.map(f => f.code)).toContain('GRAPH.DESTINATION_ENTRANCE_COVERAGE');
  });

  /**
   * La portée tranchée par l'éditeur : seules comptent les entrées qu'au moins
   * un profil de visiteur emprunte.
   */
  describe('portée — les entrées empruntées par au moins un profil', () => {
    it('ne compte pas une porte qu’aucun profil ne peut franchir', () => {
      // La porte sud ne s'ouvre que dans le sens de la sortie : son unique
      // arête ne se franchit que vers elle. On n'entre pas par là, et exiger
      // d'elle qu'elle desserve l'annuaire produisait une anomalie sur un
      // relevé exact.
      const site = oriente(
        deuxEntrees(refMultilevel), 'e-ml-entrance-sud-vestibule', 'backward');
      expect(destinationNotReachedFromEveryEntranceFindings(site)).toHaveLength(0);
    });

    /**
     * « Au moins un » : il suffit d'un profil. La porte sud n'est pas
     * accessible, donc le profil PMR ne l'emprunte pas — le profil standard,
     * lui, l'emprunte, et elle reste comptée.
     */
    it('retient une entrée qu’un seul des profils emprunte', () => {
      const base = oriente(deuxEntrees(refMultilevel), 'e-ml-vestibule-sud-hall', 'backward');
      const site: SiteData = {
        ...base,
        graph: {
          ...base.graph,
          edges: base.graph.edges.map(e => (e.id === 'e-ml-entrance-sud-vestibule'
            ? { ...e, accessible: false }
            : e)),
        },
      };
      expect(site.travel_profiles.some(p => p.require_accessible)).toBe(true);
      expect(site.travel_profiles.some(p => !p.require_accessible)).toBe(true);
      expect(destinationNotReachedFromEveryEntranceFindings(site))
        .toHaveLength(site.destinations.length);
    });

    /**
     * Le contre-exemple du précédent : si **aucun** profil ne peut franchir la
     * porte, elle sort de la portée. Ici tous les profils exigent
     * l'accessibilité, et l'arête de la porte sud ne l'est pas.
     */
    it('écarte l’entrée qu’aucun profil ne peut franchir', () => {
      const base = oriente(deuxEntrees(refMultilevel), 'e-ml-vestibule-sud-hall', 'backward');
      const site: SiteData = {
        ...base,
        travel_profiles: base.travel_profiles.map(p => ({ ...p, require_accessible: true })),
        graph: {
          ...base.graph,
          edges: base.graph.edges.map(e => (e.id === 'e-ml-entrance-sud-vestibule'
            ? { ...e, accessible: false }
            : e)),
        },
      };
      expect(destinationNotReachedFromEveryEntranceFindings(site)).toHaveLength(0);
    });

    /**
     * La conséquence à dire plutôt qu'à découvrir : sans profil, « empruntée
     * par au moins un profil » n'est pas décidable, et le contrôle ne lève
     * rien. C'est le cas de la session d'atelier de la tranche 1.
     */
    it('ne lève rien sur un site qui ne déclare aucun profil', () => {
      const site = sansProfil(
        oriente(deuxEntrees(refMultilevel), 'e-ml-vestibule-sud-hall', 'backward'));
      expect(destinationNotReachedFromEveryEntranceFindings(site)).toHaveLength(0);
      // Le contre-exemple : le même site, avec ses profils, la lève.
      expect(destinationNotReachedFromEveryEntranceFindings(
        oriente(deuxEntrees(refMultilevel), 'e-ml-vestibule-sud-hall', 'backward'),
      ).length).toBeGreaterThan(0);
    });
  });
});
