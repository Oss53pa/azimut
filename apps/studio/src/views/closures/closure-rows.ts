/**
 * O11 — les fermetures temporaires, lues pour l'écran.
 *
 * Rien n'est jugé ici : une arête fermée à un instant l'est parce qu'une
 * fermeture en cours la porte, et c'est le moteur d'itinéraire qui en tire la
 * conséquence quand il reçoit cet instant.
 */
import {
  closedEdgesAt, closuresOverlapping, sortClosures, type Edge, type SiteData, type TemporaryClosure,
} from '@azimut/core-model';

/** Les fermetures du site, dans un ordre stable. */
export function closureRows(site: SiteData): readonly TemporaryClosure[] {
  return sortClosures(site.temporary_closures ?? []);
}

/** Les arêtes fermées à l'instant donné. */
export function edgesClosedAt(site: SiteData, at: string): readonly Edge[] {
  const closed = closedEdgesAt(site.temporary_closures ?? [], at);
  return site.graph.edges.filter(e => closed.has(e.id));
}

/**
 * Les fermetures qui touchent une journée de pose : celles qui portent une
 * arête aboutissant aux nœuds des supports du créneau. `day` est `AAAA-MM-JJ`.
 */
export function closuresOnDay(site: SiteData, supportIds: readonly string[], day: string): readonly TemporaryClosure[] {
  const ids = new Set(supportIds);
  const nodes = new Set(site.supports.filter(s => ids.has(s.id)).map(s => s.node_id));
  const edges = new Set(site.graph.edges
    .filter(e => nodes.has(e.from_node_id) || nodes.has(e.to_node_id))
    .map(e => e.id));
  return sortClosures(closuresOverlapping(site.temporary_closures ?? [], `${day}T00:00:00`, `${day}T23:59:59`))
    .filter(c => c.edge_ids.some(id => edges.has(id)));
}

/** Les fermetures qui portent au moins une arête d'un chemin d'évacuation. */
export function closuresOnEvacuation(site: SiteData): readonly TemporaryClosure[] {
  const evacuation = new Set(site.graph.edges.filter(e => e.evacuation_route).map(e => e.id));
  return closureRows(site).filter(c => c.edge_ids.some(id => evacuation.has(id)));
}
