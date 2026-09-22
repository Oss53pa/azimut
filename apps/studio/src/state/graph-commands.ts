/**
 * M4 (partie M) — écriture du graphe.
 *
 * Un axe tracé en une passe produit des nœuds, des arêtes, et parfois des
 * liaisons verticales. Les trois tables appartiennent au module 01 (L3), et
 * tout part sous un même groupe : « un tracé continu produisant nœuds et
 * arêtes en une passe » est un geste, donc une annulation.
 */
import type { EntityCommand, Outcome } from '@azimut/core-model';
import { buildCommand } from '@azimut/core-model';
import type { AcceptedEdge, AcceptedNode, VerticalLinkKind } from './graph-input.js';

export type GraphWrite = {
  readonly orgId: string;
  readonly levelId: string;
  /** ISO-8601, fourni par l'appelant (E5.1). */
  readonly timestamp: string;
};

export type NodeRow = { readonly id: string; readonly node: AcceptedNode };
export type EdgeRow = { readonly id: string; readonly edge: AcceptedEdge };
export type VerticalLinkRow = {
  readonly id: string;
  readonly edgeId: string;
  readonly kind: VerticalLinkKind;
  readonly accessible: boolean;
  readonly capacity: number | null;
};

/**
 * Les commandes d'un geste de saisie du graphe.
 *
 * L'ordre suit les dépendances : les nœuds, puis les arêtes qui les citent,
 * puis les liaisons verticales qui citent les arêtes. L'annulation les inverse
 * en ordre inverse, ce que le magasin fait déjà — c'est la seule façon de ne
 * pas heurter les clés étrangères.
 */
export function graphCommands(
  nodes: readonly NodeRow[],
  edges: readonly EdgeRow[],
  links: readonly VerticalLinkRow[],
  write: GraphWrite,
  groupKey: string,
): Outcome<readonly EntityCommand[]> {
  const common = {
    operation: 'create' as const,
    module: '01-socle' as const,
    org_id: write.orgId,
    timestamp: write.timestamp,
    groupKey,
  };
  const commands: EntityCommand[] = [];

  for (const row of nodes) {
    const built = buildCommand({
      ...common,
      table: 'node',
      id: row.id,
      after: {
        id: row.id,
        org_id: write.orgId,
        level_id: write.levelId,
        kind: row.node.kind,
        position: JSON.stringify(row.node.position),
        label: row.node.label,
      },
    });
    if (!built.ok) return { ok: false, findings: built.findings };
    commands.push(built.value);
  }

  for (const row of edges) {
    const built = buildCommand({
      ...common,
      table: 'edge',
      id: row.id,
      after: {
        id: row.id,
        org_id: write.orgId,
        from_node_id: row.edge.fromNodeId,
        to_node_id: row.edge.toNodeId,
        width_m: String(row.edge.widthM),
        slope_pct: String(row.edge.slopePct),
        accessible: row.edge.accessible,
        direction: row.edge.direction,
        evacuation_route: row.edge.evacuationRoute,
        // Calculée, jamais saisie (M4, partie M ; A5.3). Elle est écrite
        // parce que la base la porte, mais elle vient de `edgeLengthBetween`.
        length_m: String(row.edge.lengthM),
      },
    });
    if (!built.ok) return { ok: false, findings: built.findings };
    commands.push(built.value);
  }

  for (const row of links) {
    const built = buildCommand({
      ...common,
      table: 'vertical_link',
      id: row.id,
      after: {
        id: row.id,
        org_id: write.orgId,
        edge_id: row.edgeId,
        kind: row.kind,
        accessible: row.accessible,
        capacity: row.capacity,
      },
    });
    if (!built.ok) return { ok: false, findings: built.findings };
    commands.push(built.value);
  }

  return { ok: true, value: commands, warnings: [] };
}
