/**
 * M4 (partie M) — l'axe de circulation, de la saisie aux commandes.
 *
 * Le déroulement de l'axe lui-même — quels sommets, quels segments — vit dans
 * `unfoldAxis`, qui le fait depuis le début et porte ses propres essais. Ce
 * module ne le refait pas : il l'entoure. Deux implémentations d'un même
 * contrôle finissent par diverger, et c'est alors le dernier écrit qui décide.
 *
 * Ce qu'il ajoute, et que `unfoldAxis` ne peut pas faire seul :
 *
 *  · `unfoldAxis` reçoit l'identifiant du nœud existant sous chaque point, parce
 *    qu'au pointeur c'est la zone de travail qui le connaît. Saisi au clavier,
 *    personne ne le connaît : il faut le chercher dans le graphe, et c'est fait
 *    ici, à la même maille que `unfoldAxis` emploie pour confondre deux points
 *    — la position quantifiée au millimètre (E4.2). Une seconde notion de
 *    « même point » ferait reprendre un nœud d'un côté et pas de l'autre.
 *
 *  · le second doublon, celui des arêtes. Un segment qui redouble une arête
 *    déjà tracée ne la recrée pas : le graphe porterait deux chemins là où il
 *    y en a un, et toute longueur cumulée serait fausse.
 */
import type { Finding, NodeKind, Outcome, Point } from '@azimut/core-model';
import { quantizePoint } from '@azimut/core-model';
import { acceptEdge, acceptNode, unfoldAxis } from './graph-input.js';
import type { EdgeDirection } from './graph-input.js';
import type { EdgeRow, NodeRow } from './graph-commands.js';

/** Un nœud déjà porté par le niveau, tel que l'axe peut le reprendre. */
export type AxisNode = { readonly id: string; readonly position: Point };

/** Une arête déjà portée par le niveau, tel que l'axe peut la reconnaître. */
export type AxisEdge = { readonly fromNodeId: string; readonly toNodeId: string };

export type AxisContext = {
  readonly nodes: readonly AxisNode[];
  readonly edges: readonly AxisEdge[];
  readonly levelId: string;
  /** M4 (partie M) : le type se choisit avant le geste, ici aussi. */
  readonly kind: NodeKind;
  readonly widthM: number;
  readonly direction: EdgeDirection;
  /**
   * Un identifiant neuf. Fourni par l'appelant, comme l'horodatage d'une
   * commande (E5.1) : un module qui tirerait les siens rendrait le geste
   * irreproductible, contre INV-4.
   */
  readonly mintId: () => string;
};

export type AcceptedAxis = {
  readonly nodes: readonly NodeRow[];
  readonly edges: readonly EdgeRow[];
  /** Nœuds existants que l'axe a repris au lieu d'en créer. */
  readonly reused: readonly string[];
  /** Segments qui redoublaient une arête existante, et n'ont rien créé. */
  readonly skipped: number;
};

const EMPTY_AXIS: AcceptedAxis = { nodes: [], edges: [], reused: [], skipped: 0 };

/** La maille de `unfoldAxis` : le millimètre, maille du modèle (E4.2). */
function positionKey(point: Point): string {
  const q = quantizePoint(point);
  return `${q.x_m.toFixed(3)},${q.y_m.toFixed(3)}`;
}

function pairKey(a: string, b: string): string {
  // Le sens ne distingue pas deux arêtes : A5.3 le porte sur l'arête, et non
  // sur le couple. Deux arêtes entre les mêmes nœuds seraient un doublon quel
  // que soit leur sens.
  return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

/**
 * Un axe de moins de deux points ne produit rien, et ce n'est pas une
 * anomalie : il n'a aucun segment, et poser son unique nœud écrirait un
 * orphelin que la validation refuserait aussitôt. Le cahier des charges ne
 * donne aucun code pour ce cas, et en inventer un dans un catalogue fermé dont
 * dépendent les dictionnaires et les exports serait une décision qui ne revient
 * pas à ce module. L'écran ne laisse pas presser l'action sous deux points.
 */
export function acceptAxis(
  points: readonly Point[],
  context: AxisContext,
): Outcome<AcceptedAxis> {
  if (points.length < 2) return { ok: true, value: EMPTY_AXIS, warnings: [] };

  const nodeAt = new Map<string, string>();
  for (const node of context.nodes) nodeAt.set(positionKey(node.position), node.id);

  const unfolded = unfoldAxis(points.map(position => ({
    position,
    existingNodeId: nodeAt.get(positionKey(position)) ?? null,
  })));

  const created: NodeRow[] = [];
  const reused: string[] = [];
  /** L'identifiant de chaque sommet, dans l'ordre où `unfoldAxis` les rend. */
  const idOf: string[] = [];

  for (const vertex of unfolded.vertices) {
    if (vertex.kind === 'existing') {
      idOf.push(vertex.nodeId);
      if (!reused.includes(vertex.nodeId)) reused.push(vertex.nodeId);
      continue;
    }
    const id = context.mintId();
    created.push({
      id,
      node: acceptNode({ kind: context.kind, label: '', position: vertex.position }),
    });
    idOf.push(id);
  }

  const links = new Set(context.edges.map(e => pairKey(e.fromNodeId, e.toNodeId)));
  const edges: EdgeRow[] = [];
  const findings: Finding[] = [];
  let skipped = 0;

  for (const [from, to] of unfolded.segments) {
    const fromId = idOf[from];
    const toId = idOf[to];
    const fromVertex = unfolded.vertices[from];
    const toVertex = unfolded.vertices[to];
    if (fromId === undefined || toId === undefined) continue;
    if (fromVertex === undefined || toVertex === undefined) continue;
    if (links.has(pairKey(fromId, toId))) { skipped += 1; continue; }

    const outcome = acceptEdge({
      from: {
        nodeId: fromId, levelId: context.levelId,
        position: fromVertex.position, elevation_m: 0,
      },
      to: {
        nodeId: toId, levelId: context.levelId,
        position: toVertex.position, elevation_m: 0,
      },
      widthM: context.widthM,
      slopePct: 0,
      accessible: true,
      direction: context.direction,
      evacuationRoute: false,
      hasVerticalLink: false,
    });
    if (!outcome.ok) { findings.push(...outcome.findings); continue; }

    edges.push({ id: context.mintId(), edge: outcome.value });
    links.add(pairKey(fromId, toId));
  }

  // Rien n'est écrit si un segment est refusé : un axe à moitié tracé laisse
  // un graphe que l'opérateur n'a pas voulu, et qu'il devra défaire segment
  // par segment.
  if (findings.length > 0) return { ok: false, findings };
  return { ok: true, value: { nodes: created, edges, reused, skipped }, warnings: [] };
}
