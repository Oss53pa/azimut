/**
 * A5.3 — les fermetures d'arêtes, lues pour l'écran : une ligne par
 * fermeture déclarée, et une par disponibilité illisible.
 *
 * Rien n'est jugé ici : une arête fermée à un instant l'est parce que
 * `isClosedAt` le dit, et c'est le moteur d'itinéraire qui en tire la
 * conséquence quand il reçoit cet instant.
 */
import { closuresOverlapping, isClosedAt, type Edge, type EdgeClosure, type SiteData } from '@azimut/core-model';

export type ClosureRow = {
  readonly edge: Edge;
  /** `null` pour une disponibilité illisible. */
  readonly closure: EdgeClosure | null;
};

function rowsOf(edge: Edge, closures: (e: Edge) => readonly EdgeClosure[]): ClosureRow[] {
  const availability = edge.availability;
  if (availability === undefined) return [];
  if (!availability.readable) return [{ edge, closure: null }];
  return closures(edge).map(closure => ({ edge, closure }));
}

export function closureRows(site: SiteData): readonly ClosureRow[] {
  return [...site.graph.edges]
    .sort((a, b) => a.id.localeCompare(b.id))
    .flatMap(edge => rowsOf(edge, e => (e.availability?.readable === true ? e.availability.closures : [])));
}

/** Les arêtes fermées à l'instant donné, illisibles comprises. */
export function edgesClosedAt(site: SiteData, at: string): readonly Edge[] {
  return site.graph.edges.filter(e => isClosedAt(e.availability, at));
}

/**
 * Les fermetures qui touchent une journée de pose : celles des arêtes qui
 * aboutissent aux nœuds des supports du créneau. `day` est `AAAA-MM-JJ`.
 */
export function closuresOnDay(site: SiteData, supportIds: readonly string[], day: string): readonly ClosureRow[] {
  const ids = new Set(supportIds);
  const nodes = new Set(site.supports.filter(s => ids.has(s.id)).map(s => s.node_id));
  const from = `${day}T00:00:00`;
  const to = `${day}T23:59:59`;
  return [...site.graph.edges]
    .filter(e => nodes.has(e.from_node_id) || nodes.has(e.to_node_id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .flatMap(edge => rowsOf(edge, e => closuresOverlapping(e.availability, from, to)));
}
