/**
 * M4 (partie M) — la modification d'un nœud ou d'une arête déjà écrits.
 *
 * Le panneau de propriétés de M4 édite ce que la saisie a posé. Une
 * modification passe par une commande de mise à jour, qui porte l'état avant
 * et l'état après (E5.1) : c'est ce qui la rend réversible, et l'annulation
 * écrit simplement la commande inverse.
 *
 * « La longueur est recalculée à toute modification de position. Un champ de
 * longueur saisissable serait une source permanente d'incohérence. » Déplacer
 * un nœud met donc à jour, dans le même geste, la longueur de toutes les
 * arêtes qui le touchent. Les laisser en l'état écrirait en base des longueurs
 * qui ne correspondent plus à leurs extrémités, et aucun écran ne le dirait.
 */
import type { EntityCommand, Edge, GraphNode, Outcome, Point } from '@azimut/core-model';
import { buildCommand, edgeLengthBetween, quantizePoint } from '@azimut/core-model';
import type { EdgeDirection } from './graph-input.js';

export type GraphWriteContext = {
  readonly orgId: string;
  /** ISO-8601, fourni par l'appelant (E5.1). */
  readonly timestamp: string;
};

/** Ce que le panneau de M4 (partie M) permet de changer sur un nœud. */
export type NodeEdit = {
  readonly kind: GraphNode['kind'];
  readonly label: string;
  readonly position: Point;
};

/** Ce que le panneau de M4 (partie M) permet de changer sur une arête. */
export type EdgeEdit = {
  readonly widthM: number;
  readonly slopePct: number;
  readonly accessible: boolean;
  readonly direction: EdgeDirection;
  readonly evacuationRoute: boolean;
};

/**
 * Les commandes d'une modification de nœud, longueurs d'arêtes comprises.
 *
 * Les arêtes touchées sont celles qui citent le nœud. Une arête dont l'autre
 * extrémité est inconnue est laissée : sa longueur n'est pas calculable, et en
 * inventer une masquerait le nœud manquant que `validateGraph` signale.
 */
export function updateNodeCommands(
  before: GraphNode,
  edit: NodeEdit,
  edges: readonly Edge[],
  nodes: readonly GraphNode[],
  context: GraphWriteContext,
  groupKey: string,
): Outcome<readonly EntityCommand[]> {
  const position = quantizePoint(edit.position);
  const common = {
    operation: 'update' as const,
    module: '01-socle' as const,
    org_id: context.orgId,
    timestamp: context.timestamp,
    groupKey,
  };

  const commands: EntityCommand[] = [];
  const node = buildCommand({
    ...common,
    table: 'node',
    id: before.id,
    before: {
      kind: before.kind,
      label: before.label,
      position: JSON.stringify(before.position),
    },
    after: {
      kind: edit.kind,
      label: edit.label.trim(),
      position: JSON.stringify(position),
    },
  });
  if (!node.ok) return { ok: false, findings: node.findings };
  commands.push(node.value);

  const moved = new Map(nodes.map(n => [n.id, n.position]));
  moved.set(before.id, position);

  for (const edge of edges) {
    if (edge.from_node_id !== before.id && edge.to_node_id !== before.id) continue;
    const from = moved.get(edge.from_node_id);
    const to = moved.get(edge.to_node_id);
    if (from === undefined || to === undefined) continue;

    const length = edgeLengthBetween(
      { position: from, elevation_m: 0 },
      { position: to, elevation_m: 0 },
    );
    if (length === edge.length_m) continue;

    const built = buildCommand({
      ...common,
      table: 'edge',
      id: edge.id,
      before: { length_m: String(edge.length_m) },
      after: { length_m: String(length) },
    });
    if (!built.ok) return { ok: false, findings: built.findings };
    commands.push(built.value);
  }

  return { ok: true, value: commands, warnings: [] };
}

/**
 * Les commandes d'une modification d'arête.
 *
 * La longueur n'y figure pas : elle est calculée depuis les positions, et
 * aucun champ du panneau ne la touche (M4, partie M).
 */
export function updateEdgeCommands(
  before: Edge,
  edit: EdgeEdit,
  context: GraphWriteContext,
  groupKey: string,
): Outcome<readonly EntityCommand[]> {
  const built = buildCommand({
    operation: 'update',
    module: '01-socle',
    org_id: context.orgId,
    timestamp: context.timestamp,
    groupKey,
    table: 'edge',
    id: before.id,
    before: {
      width_m: String(before.width_m),
      slope_pct: String(before.slope_pct),
      accessible: before.accessible,
      direction: before.direction,
      evacuation_route: before.evacuation_route,
    },
    after: {
      width_m: String(edit.widthM),
      slope_pct: String(edit.slopePct),
      accessible: edit.accessible,
      direction: edit.direction,
      evacuation_route: edit.evacuationRoute,
    },
  });
  if (!built.ok) return { ok: false, findings: built.findings };
  return { ok: true, value: [built.value], warnings: [] };
}
