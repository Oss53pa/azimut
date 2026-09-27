import type { SiteData, Finding } from '@azimut/core-model';

/**
 * A5.3 — ce que les fermetures d'arêtes (`edge.availability`) demandent de
 * voir, sans instant : le contrôle ne lit pas l'horloge (INV-4).
 *
 *  - `GRAPH.EDGE_AVAILABILITY_UNREADABLE` (bloquant) : une disponibilité
 *    illisible. Elle n'est pas écartée ; à un instant donné l'arête compte
 *    pour fermée, et personne ne peut dire jusqu'à quand.
 *  - `GRAPH.EVACUATION_EDGE_CLOSURE` (avertissement) : un chemin d'évacuation
 *    porte une fermeture déclarée. Le plan d'évacuation, imprimé et durable,
 *    ne la voit pas (décision du 26/09/2026) ; ce contrôle la montre, une par
 *    fermeture, pour qu'une décision humaine soit prise sur la période.
 */
export function checkEdgeAvailability(site: SiteData): Finding[] {
  const findings: Finding[] = [];
  const edges = [...site.graph.edges].sort((a, b) => a.id.localeCompare(b.id));

  for (const edge of edges) {
    const availability = edge.availability;
    if (availability === undefined) continue;
    if (!availability.readable) {
      findings.push({
        code: 'GRAPH.EDGE_AVAILABILITY_UNREADABLE',
        severity: 'blocking',
        entity: { kind: 'edge', id: edge.id },
        params: {},
        ruleRef: 'A5.3',
      });
      continue;
    }
    if (!edge.evacuation_route) continue;
    for (const closure of availability.closures) {
      findings.push({
        code: 'GRAPH.EVACUATION_EDGE_CLOSURE',
        severity: 'warning',
        entity: { kind: 'edge', id: edge.id },
        params: { from: closure.from, to: closure.to, reason_key: closure.reason_key },
        ruleRef: 'A5.3',
      });
    }
  }

  return findings;
}
