import type {
  SiteData,
  TravelProfile,
  Outcome,
  Finding,
} from '@azimut/core-model';
import { computeRoute } from '@azimut/engine-graph';
import type { Route } from '@azimut/engine-graph';

export type WayfindingStep = {
  readonly node_id: string;
  readonly label: string;
  readonly level_id: string;
  readonly kind: string;
  readonly instruction: string;
};

export type WayfindingResult = {
  readonly route: Route;
  readonly steps: readonly WayfindingStep[];
  readonly total_distance_m: number;
  readonly level_changes: number;
};

function buildInstruction(
  currentKind: string,
  nextKind: string | null,
  label: string,
  isLevelChange: boolean,
): string {
  if (currentKind === 'entrance') {
    return `Depuis ${label}`;
  }
  if (currentKind === 'elevator') {
    return isLevelChange
      ? `Prendre l'ascenseur (${label})`
      : `Passer devant ${label}`;
  }
  if (currentKind === 'stair') {
    return isLevelChange
      ? `Prendre l'escalier (${label})`
      : `Passer devant ${label}`;
  }
  if (currentKind === 'escalator') {
    return isLevelChange
      ? `Prendre l'escalator (${label})`
      : `Passer devant ${label}`;
  }
  if (currentKind === 'destination_access') {
    if (nextKind === null) {
      return `Arrivée : ${label}`;
    }
    return `Passer devant ${label}`;
  }
  if (currentKind === 'junction' || currentKind === 'landing') {
    return `Continuer vers ${label}`;
  }
  return `Passer par ${label}`;
}

export function computeWayfinding(
  site: SiteData,
  profile: TravelProfile,
  fromNodeId: string,
  toNodeId: string,
): Outcome<WayfindingResult> {
  const routeResult = computeRoute(site, profile, fromNodeId, toNodeId);
  if (!routeResult.ok) {
    return routeResult;
  }

  const route = routeResult.value;
  const warnings: Finding[] = [...routeResult.warnings];

  const nodeMap = new Map(
    site.graph.nodes.map((n) => [n.id, n]),
  );
  const edgeMap = new Map(
    site.graph.edges.map((e) => [e.id, e]),
  );

  const steps: WayfindingStep[] = [];
  let levelChanges = 0;
  let totalDistance = 0;

  for (let i = 0; i < route.path.length; i++) {
    const nodeId = route.path[i] as string;
    const node = nodeMap.get(nodeId);
    if (!node) continue;

    const nextNodeId = i < route.path.length - 1
      ? route.path[i + 1] as string
      : null;
    const nextNode = nextNodeId ? nodeMap.get(nextNodeId) : null;

    const isLevelChange = nextNode !== null
      && nextNode !== undefined
      && nextNode.level_id !== node.level_id;

    if (isLevelChange) {
      levelChanges++;
    }

    const instruction = buildInstruction(
      node.kind,
      nextNode?.kind ?? null,
      node.label,
      isLevelChange,
    );

    steps.push({
      node_id: node.id,
      label: node.label,
      level_id: node.level_id,
      kind: node.kind,
      instruction,
    });
  }

  for (const edgeId of route.edges) {
    const edge = edgeMap.get(edgeId);
    if (edge) {
      totalDistance += edge.length_m;
    }
  }

  const result: WayfindingResult = {
    route,
    steps,
    total_distance_m: Math.round(totalDistance * 100) / 100,
    level_changes: levelChanges,
  };

  return { ok: true, value: result, warnings };
}
