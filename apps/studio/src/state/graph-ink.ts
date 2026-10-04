import type { Point } from '@azimut/core-model';
import { recognize } from '../editor/ink/recognize.js';
import type { InkNode } from '../editor/ink/recognize.js';
import { DEFAULT_ANGLE_STEP_DEG } from '../editor/ink/recognition-thresholds.js';
import type { Strictness } from '../editor/ink/recognition-thresholds.js';
import { toleranceFor } from '../editor/ink/pointer-kind.js';
import type { PointerKind } from '../editor/ink/pointer-kind.js';
import type { GraphTool } from './graph-shortcuts.js';

/**
 * J1.2 (partie J) appliqué à l'atelier du graphe (M4, partie M).
 *
 * « Point appuyé : nœud, du type actif dans la barre d'outils. » « Trait
 * rejoignant deux formes : arête du graphe entre deux nœuds. » L'outil actif
 * dit lequel des deux gestes est attendu (J2) : l'outil « Nœud » pose, l'outil
 * « Arête » relie. Le parcours se calcule ensuite depuis ce réseau ; il ne se
 * dessine jamais à la main (INV-1).
 *
 * Un point appuyé sur un nœud déjà posé n'en pose pas un second par-dessus :
 * c'est un geste de sélection, que la vue traite.
 */
/**
 * Portée d'un nœud pour le départ et l'arrivée d'un trait, en pixels écran :
 * le demi-côté de son symbole (`GraphView`) et une marge de geste. Paramètre
 * d'ergonomie.
 */
export const NODE_MARK_REACH_PX = 10;

export type GraphInkOutcome =
  | { readonly kind: 'place_node'; readonly at: Point }
  | { readonly kind: 'draw_edge'; readonly fromNodeId: string; readonly toNodeId: string }
  | { readonly kind: 'on_existing_node'; readonly nodeId: string }
  | { readonly kind: 'unrecognized' }
  | { readonly kind: 'not_graph_tool' };

export type GraphStrokeContext = {
  readonly tool: GraphTool;
  readonly pointer: PointerKind;
  readonly pxPerMeter: number;
  readonly strictness: Strictness;
  /** Les nœuds du niveau courant. */
  readonly nodes: readonly InkNode[];
};

/** Le nœud posé à portée du point, s'il y en a un. */
function nodeAt(at: Point, context: GraphStrokeContext): InkNode | null {
  const reach_px = toleranceFor(context.pointer).select_px;
  let best: InkNode | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const node of context.nodes) {
    const d = Math.hypot(node.at.x_m - at.x_m, node.at.y_m - at.y_m) * context.pxPerMeter;
    if (d <= reach_px && d < bestDistance) { best = node; bestDistance = d; }
  }
  return best;
}

/** Ce qu'un trait achevé produit dans l'atelier du graphe. */
export function strokeToGraph(points: readonly Point[], context: GraphStrokeContext): GraphInkOutcome {
  if (context.tool !== 'node' && context.tool !== 'edge') return { kind: 'not_graph_tool' };
  const candidates = recognize(points, {
    pxPerMeter: context.pxPerMeter,
    strictness: context.strictness,
    angleStep_deg: DEFAULT_ANGLE_STEP_DEG,
    // Un nœud se marque par un symbole de quelques pixels : le trait doit
    // pouvoir partir de ce symbole, et non de son seul centre.
    hit_px: Math.max(toleranceFor(context.pointer).select_px, NODE_MARK_REACH_PX),
    nodes: context.nodes,
    shapes: [],
  });

  if (context.tool === 'node') {
    const tap = candidates.find(c => c.kind === 'node');
    if (tap === undefined || tap.kind !== 'node') return { kind: 'unrecognized' };
    const existing = nodeAt(tap.at, context);
    return existing !== null ? { kind: 'on_existing_node', nodeId: existing.id } : { kind: 'place_node', at: tap.at };
  }

  const edge = candidates.find(c => c.kind === 'edge');
  if (edge === undefined || edge.kind !== 'edge') return { kind: 'unrecognized' };
  return { kind: 'draw_edge', fromNodeId: edge.fromNodeId, toNodeId: edge.toNodeId };
}
