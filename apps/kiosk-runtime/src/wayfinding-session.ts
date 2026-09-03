import type {
  SiteData,
  TravelProfile,
  Outcome,
  Finding,
} from '@azimut/core-model';
import { computeRoute } from '@azimut/engine-graph';
import type { Route } from '@azimut/engine-graph';

export type WayfindingLang = 'fr' | 'en';

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

type InstructionTemplates = {
  readonly from: (label: string) => string;
  readonly takeElevator: (label: string) => string;
  readonly takeStairs: (label: string) => string;
  readonly takeEscalator: (label: string) => string;
  readonly passby: (label: string) => string;
  readonly arrival: (label: string) => string;
  readonly continueTowards: (label: string) => string;
  readonly continueFor: (meters: number) => string;
  readonly goThrough: (label: string) => string;
};

const INSTRUCTIONS: Record<WayfindingLang, InstructionTemplates> = {
  fr: {
    from: (l) => `Depuis ${l}`,
    takeElevator: (l) => `Prendre l'ascenseur (${l})`,
    takeStairs: (l) => `Prendre l'escalier (${l})`,
    takeEscalator: (l) => `Prendre l'escalator (${l})`,
    passby: (l) => `Passer devant ${l}`,
    arrival: (l) => `Arrivée : ${l}`,
    continueTowards: (l) => `Continuer vers ${l}`,
    continueFor: (m) => `Continuer tout droit (${Math.round(m)} m)`,
    goThrough: (l) => `Passer par ${l}`,
  },
  en: {
    from: (l) => `From ${l}`,
    takeElevator: (l) => `Take the elevator (${l})`,
    takeStairs: (l) => `Take the stairs (${l})`,
    takeEscalator: (l) => `Take the escalator (${l})`,
    passby: (l) => `Pass by ${l}`,
    arrival: (l) => `Arrival: ${l}`,
    continueTowards: (l) => `Continue towards ${l}`,
    continueFor: (m) => `Continue straight (${Math.round(m)} m)`,
    goThrough: (l) => `Go through ${l}`,
  },
};

function buildInstruction(
  templates: InstructionTemplates,
  currentKind: string,
  nextKind: string | null,
  label: string,
  isLevelChange: boolean,
): string {
  if (currentKind === 'entrance') {
    return templates.from(label);
  }
  if (currentKind === 'elevator') {
    return isLevelChange
      ? templates.takeElevator(label)
      : templates.passby(label);
  }
  if (currentKind === 'stair') {
    return isLevelChange
      ? templates.takeStairs(label)
      : templates.passby(label);
  }
  if (currentKind === 'escalator') {
    return isLevelChange
      ? templates.takeEscalator(label)
      : templates.passby(label);
  }
  if (currentKind === 'destination_access') {
    if (nextKind === null) {
      return templates.arrival(label);
    }
    return templates.passby(label);
  }
  if (currentKind === 'junction' || currentKind === 'landing') {
    return templates.continueTowards(label);
  }
  return templates.goThrough(label);
}

export type WayfindingOptions = {
  readonly lang?: WayfindingLang;
};

export function computeWayfinding(
  site: SiteData,
  profile: TravelProfile,
  fromNodeId: string,
  toNodeId: string,
  options?: WayfindingOptions,
): Outcome<WayfindingResult> {
  const lang = options?.lang ?? 'fr';
  const templates = INSTRUCTIONS[lang];

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

  const collapsible = new Set(['junction', 'landing']);

  const rawSteps: WayfindingStep[] = [];
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
      templates,
      node.kind,
      nextNode?.kind ?? null,
      node.label,
      isLevelChange,
    );

    rawSteps.push({
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

  // Collapse consecutive same-level junction/landing steps into
  // a single "continue for X m" step to reduce noise.
  const steps: WayfindingStep[] = [];
  let runStart = -1;
  let runDistance = 0;

  for (let i = 0; i < rawSteps.length; i++) {
    const step = rawSteps[i] as WayfindingStep;
    const isCollapsible = collapsible.has(step.kind);
    const prevStep = i > 0 ? rawSteps[i - 1] as WayfindingStep : null;
    const sameLevel = prevStep !== null && prevStep.level_id === step.level_id;

    if (isCollapsible && prevStep !== null && collapsible.has(prevStep.kind) && sameLevel) {
      // Continuing a run — accumulate the edge distance.
      const edgeId = route.edges[i - 1];
      const edge = edgeId !== undefined ? edgeMap.get(edgeId) : undefined;
      runDistance += edge?.length_m ?? 0;
    } else {
      // End previous run if any.
      if (runStart >= 0 && runStart < i - 1) {
        const lastInRun = rawSteps[i - 1] as WayfindingStep;
        steps.push({
          node_id: lastInRun.node_id,
          label: lastInRun.label,
          level_id: lastInRun.level_id,
          kind: lastInRun.kind,
          instruction: runDistance > 0
            ? templates.continueFor(runDistance)
            : lastInRun.instruction,
        });
      } else if (runStart >= 0) {
        // Single-node run — keep original step.
        steps.push(rawSteps[runStart] as WayfindingStep);
      }

      // Start new run or emit non-collapsible step.
      if (isCollapsible) {
        runStart = i;
        // Start fresh run distance — include the edge leading to this node
        // if the previous step was NOT collapsible.
        runDistance = 0;
      } else {
        runStart = -1;
        runDistance = 0;
        steps.push(step);
      }
    }
  }

  // Flush trailing run.
  if (runStart >= 0 && runStart < rawSteps.length - 1) {
    const lastInRun = rawSteps[rawSteps.length - 1] as WayfindingStep;
    steps.push({
      node_id: lastInRun.node_id,
      label: lastInRun.label,
      level_id: lastInRun.level_id,
      kind: lastInRun.kind,
      instruction: runDistance > 0
        ? templates.continueFor(runDistance)
        : lastInRun.instruction,
    });
  } else if (runStart >= 0) {
    steps.push(rawSteps[runStart] as WayfindingStep);
  }

  const result: WayfindingResult = {
    route,
    steps,
    total_distance_m: Math.round(totalDistance * 100) / 100,
    level_changes: levelChanges,
  };

  return { ok: true, value: result, warnings };
}
