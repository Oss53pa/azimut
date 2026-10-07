import type { SiteGraph } from '@azimut/core-model';
import type { Route } from './compute-route.js';

/**
 * Partie P, écran Itinéraire — les étapes écrites d'un itinéraire, sous forme neutre.
 *
 * « Étapes écrites, courtes, dans la langue active. Changement de niveau
 * signalé explicitement, avec le moyen. » Un moteur ne produit jamais de texte
 * destiné à l'affichage (A7) : chaque étape porte un code et ses paramètres,
 * et c'est l'interface — la borne, l'atelier — qui les dit dans sa langue.
 *
 * La règle est celle que la borne appliquait seule : une étape par nœud du
 * chemin, puis les carrefours et paliers consécutifs d'un même niveau réunis
 * en un « continuer tout droit » qui porte la distance parcourue.
 */
export type StepInstruction =
  | { readonly key: 'from' | 'take_elevator' | 'take_stairs' | 'take_escalator' | 'pass_by'
      | 'arrival' | 'continue_towards' | 'go_through'; readonly label: string }
  | { readonly key: 'continue_for'; readonly distance_m: number };

export type RouteStep = {
  readonly node_id: string;
  readonly label: string;
  readonly level_id: string;
  readonly kind: string;
  readonly instruction: StepInstruction;
};

export type RouteSteps = {
  readonly steps: readonly RouteStep[];
  readonly total_distance_m: number;
  readonly level_changes: number;
};

function instructionOf(kind: string, nextKind: string | null, label: string, levelChange: boolean): StepInstruction {
  if (kind === 'entrance') return { key: 'from', label };
  if (kind === 'elevator') return { key: levelChange ? 'take_elevator' : 'pass_by', label };
  if (kind === 'stair') return { key: levelChange ? 'take_stairs' : 'pass_by', label };
  if (kind === 'escalator') return { key: levelChange ? 'take_escalator' : 'pass_by', label };
  if (kind === 'destination_access') return { key: nextKind === null ? 'arrival' : 'pass_by', label };
  if (kind === 'junction' || kind === 'landing') return { key: 'continue_towards', label };
  return { key: 'go_through', label };
}

const COLLAPSIBLE = new Set(['junction', 'landing']);

export function routeSteps(graph: Pick<SiteGraph, 'nodes' | 'edges'>, route: Route): RouteSteps {
  const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));
  const edgeMap = new Map(graph.edges.map(e => [e.id, e]));

  const raw: RouteStep[] = [];
  let levelChanges = 0;
  for (let i = 0; i < route.path.length; i++) {
    const node = nodeMap.get(route.path[i] ?? '');
    if (node === undefined) continue;
    const nextId = i < route.path.length - 1 ? route.path[i + 1] ?? null : null;
    const next = nextId === null ? undefined : nodeMap.get(nextId);
    const levelChange = next !== undefined && next.level_id !== node.level_id;
    if (levelChange) levelChanges++;
    raw.push({
      node_id: node.id, label: node.label, level_id: node.level_id, kind: node.kind,
      instruction: instructionOf(node.kind, next?.kind ?? null, node.label, levelChange),
    });
  }

  let totalDistance = 0;
  for (const edgeId of route.edges) totalDistance += edgeMap.get(edgeId)?.length_m ?? 0;

  // Les carrefours et paliers consécutifs d'un même niveau se réunissent en
  // un « continuer tout droit », pour ne pas noyer l'étape qui compte.
  const steps: RouteStep[] = [];
  let runStart = -1;
  let runDistance = 0;
  const closeRun = (end: number): void => {
    const last = raw[end];
    if (runStart >= 0 && runStart < end && last !== undefined) {
      steps.push({
        ...last,
        instruction: runDistance > 0 ? { key: 'continue_for', distance_m: runDistance } : last.instruction,
      });
    } else if (runStart >= 0) {
      const single = raw[runStart];
      if (single !== undefined) steps.push(single);
    }
  };
  for (let i = 0; i < raw.length; i++) {
    const step = raw[i];
    if (step === undefined) continue;
    const collapsible = COLLAPSIBLE.has(step.kind);
    const prev = i > 0 ? raw[i - 1] : undefined;
    const sameLevel = prev !== undefined && prev.level_id === step.level_id;
    if (collapsible && prev !== undefined && COLLAPSIBLE.has(prev.kind) && sameLevel) {
      const edgeId = route.edges[i - 1];
      runDistance += (edgeId === undefined ? undefined : edgeMap.get(edgeId))?.length_m ?? 0;
      continue;
    }
    closeRun(i - 1);
    if (collapsible) {
      runStart = i;
      runDistance = 0;
    } else {
      runStart = -1;
      runDistance = 0;
      steps.push(step);
    }
  }
  closeRun(raw.length - 1);

  return { steps, total_distance_m: Math.round(totalDistance * 100) / 100, level_changes: levelChanges };
}
