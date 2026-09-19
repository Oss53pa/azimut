import type { GraphNode, Edge } from '@azimut/core-model';

/**
 * Adjacence non orientée : `direction` n'est pas lue, et c'est voulu.
 *
 * Elle sert aux contrôles de structure — le graphe est-il d'un seul tenant, un
 * nœud est-il relié à quelque chose — qui posent une question de modèle et non
 * de circulation. Un couloir à sens unique relie bien les deux salles qu'il
 * joint, même si on ne peut le prendre que dans un sens.
 *
 * Pour savoir si un visiteur peut effectivement aller d'un point à un autre,
 * c'est `buildDirectedAdjacency` qu'il faut, ou `isEdgeTraversableFrom` quand
 * un profil de déplacement entre en jeu.
 */
export function buildAdjacency(
  nodes: readonly GraphNode[],
  edges: readonly Edge[],
): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) {
    adj.set(n.id, new Set());
  }
  for (const e of edges) {
    if (e.from_node_id === e.to_node_id) continue;
    const fromSet = adj.get(e.from_node_id);
    const toSet = adj.get(e.to_node_id);
    if (fromSet) fromSet.add(e.to_node_id);
    if (toSet) toSet.add(e.from_node_id);
  }
  return adj;
}

export function bfs(
  adj: Map<string, Set<string>>,
  start: string,
): Set<string> {
  const visited = new Set<string>();
  const queue: string[] = [start];
  visited.add(start);
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    const neighbors = adj.get(current);
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }
  return visited;
}

/**
 * Adjacence orientée : une arête `forward` ne se prend que de `from` vers `to`,
 * une arête `backward` que dans l'autre sens.
 *
 * Le champ `direction` existe au modèle depuis A5 et n'était lu que par
 * `isEdgeTraversableFrom`, c'est-à-dire par le calcul d'itinéraire et par ce
 * qui en dépend. Aucun contrôle de complétude ne le lisait : un sens unique qui
 * coupe une aile du site ne se voyait donc nulle part, puisque l'aile reste
 * reliée au sens du modèle.
 */
export function buildDirectedAdjacency(
  nodes: readonly GraphNode[],
  edges: readonly Edge[],
): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) {
    adj.set(n.id, new Set());
  }
  for (const e of edges) {
    if (e.from_node_id === e.to_node_id) continue;
    if (e.direction !== 'backward') adj.get(e.from_node_id)?.add(e.to_node_id);
    if (e.direction !== 'forward') adj.get(e.to_node_id)?.add(e.from_node_id);
  }
  return adj;
}
