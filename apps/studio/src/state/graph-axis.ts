/**
 * M4 (partie M) — l'axe de circulation, tracé en une passe.
 *
 * « Axe de circulation | `X` | Tracé continu produisant nœuds et arêtes en une
 * passe. » Critère d'acceptation 1 : « Un axe tracé en une passe produit les
 * nœuds et arêtes attendus, sans doublon. »
 *
 * « Sans doublon » porte sur deux choses, et les deux comptent. Un sommet
 * posé sur un nœud existant reprend ce nœud au lieu d'en empiler un second au
 * même point : deux nœuds superposés se ressemblent à l'écran et font deux
 * graphes disjoints au calcul. Un segment qui redouble une arête existante ne
 * la recrée pas : le graphe porterait deux chemins là où il y en a un, et
 * toute longueur cumulée serait fausse.
 *
 * La tolérance de coïncidence vient de D1.5, où elle est rangée parmi les
 * tolérances techniques et non parmi les valeurs normatives. INV-5 ne s'y
 * applique donc pas, et elle n'a pas à venir d'un paquet de règles.
 */
import type { Finding, NodeKind, Outcome, Point } from '@azimut/core-model';
import { POINT_COINCIDENCE_M } from '@azimut/core-model';
import { acceptEdge, acceptNode } from './graph-input.js';
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

function coincident(a: Point, b: Point): boolean {
  return Math.abs(a.x_m - b.x_m) <= POINT_COINCIDENCE_M
    && Math.abs(a.y_m - b.y_m) <= POINT_COINCIDENCE_M;
}

function pairKey(a: string, b: string): string {
  // Le sens ne distingue pas deux arêtes : A5.3 porte le sens sur l'arête,
  // et non sur le couple. Deux arêtes entre les mêmes nœuds seraient un
  // doublon quel que soit leur sens.
  return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

/**
 * Un axe de moins de deux points ne produit rien, et ce n'est pas une
 * anomalie : il n'a aucun segment. Le cahier des charges ne donne aucun code
 * pour ce cas, et en inventer un dans un catalogue fermé dont dépendent les
 * dictionnaires et les exports serait une décision qui ne revient pas à ce
 * module. L'écran ne laisse pas presser l'action sous deux points : c'est là
 * que la condition se tient, et elle s'y voit.
 */
export function acceptAxis(
  points: readonly Point[],
  context: AxisContext,
): Outcome<AcceptedAxis> {
  // Un axe sans segment ne pose pas davantage de nœud : un point isolé
  // écrirait un nœud orphelin, que la validation refuserait aussitôt
  // (`GRAPH.NODE_ORPHAN`) sur un geste qui n'a rien tracé.
  if (points.length < 2) {
    return { ok: true, value: EMPTY_AXIS, warnings: [] };
  }

  const known: AxisNode[] = [...context.nodes];
  const links = new Set(context.edges.map(e => pairKey(e.fromNodeId, e.toNodeId)));

  const created: NodeRow[] = [];
  const reused: string[] = [];
  const resolved: AxisNode[] = [];

  for (const point of points) {
    const node = acceptNode({ kind: context.kind, label: '', position: point });
    const found = known.find(candidate => coincident(candidate.position, node.position));
    if (found !== undefined) {
      resolved.push(found);
      if (!reused.includes(found.id)) reused.push(found.id);
      continue;
    }
    const id = context.mintId();
    created.push({ id, node });
    // Repris dans la même passe : un axe qui revient sur son propre sommet ne
    // doit pas davantage doubler un nœud qu'un axe qui revient sur celui d'un
    // autre.
    known.push({ id, position: node.position });
    resolved.push({ id, position: node.position });
  }

  const edges: EdgeRow[] = [];
  const findings: Finding[] = [];
  let skipped = 0;

  for (let i = 1; i < resolved.length; i += 1) {
    const from = resolved[i - 1];
    const to = resolved[i];
    if (from === undefined || to === undefined) continue;
    // Deux sommets coïncidents ont résolu vers le même nœud : le segment
    // n'existe pas. Le refuser lèverait `GRAPH.EDGE_SELF_LOOP` sur un geste
    // que l'opérateur n'a pas fait.
    if (from.id === to.id) { skipped += 1; continue; }
    if (links.has(pairKey(from.id, to.id))) { skipped += 1; continue; }

    const outcome = acceptEdge({
      from: { nodeId: from.id, levelId: context.levelId, position: from.position, elevation_m: 0 },
      to: { nodeId: to.id, levelId: context.levelId, position: to.position, elevation_m: 0 },
      widthM: context.widthM,
      slopePct: 0,
      accessible: true,
      direction: context.direction,
      evacuationRoute: false,
      hasVerticalLink: false,
    });
    if (!outcome.ok) { findings.push(...outcome.findings); continue; }

    edges.push({ id: context.mintId(), edge: outcome.value });
    links.add(pairKey(from.id, to.id));
  }

  // Rien n'est écrit si un segment est refusé : un axe à moitié tracé laisse
  // un graphe que l'opérateur n'a pas voulu, et qu'il devra défaire segment
  // par segment.
  if (findings.length > 0) return { ok: false, findings };
  return { ok: true, value: { nodes: created, edges, reused, skipped }, warnings: [] };
}
