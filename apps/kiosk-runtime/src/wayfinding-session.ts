import type {
  TravelProfile,
  Outcome,
} from '@azimut/core-model';
import { computeRoute, routeSteps } from '@azimut/engine-graph';
import type { Route, StepInstruction } from '@azimut/engine-graph';
import type { KioskSite } from './load-kiosk-site.js';

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

/** Une étape neutre du moteur (partie P, écran Itinéraire), dite dans la langue de la borne. */
function say(templates: InstructionTemplates, instruction: StepInstruction): string {
  switch (instruction.key) {
    case 'from': return templates.from(instruction.label);
    case 'take_elevator': return templates.takeElevator(instruction.label);
    case 'take_stairs': return templates.takeStairs(instruction.label);
    case 'take_escalator': return templates.takeEscalator(instruction.label);
    case 'pass_by': return templates.passby(instruction.label);
    case 'arrival': return templates.arrival(instruction.label);
    case 'continue_towards': return templates.continueTowards(instruction.label);
    case 'go_through': return templates.goThrough(instruction.label);
    case 'continue_for': return templates.continueFor(instruction.distance_m);
  }
}

export type WayfindingOptions = {
  readonly lang?: WayfindingLang;
};

export function computeWayfinding(
  site: KioskSite,
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
  // Les étapes viennent du moteur, sous forme neutre (partie P, écran Itinéraire ; A7) : la borne
  // n'y met que ses mots.
  const computed = routeSteps(site.graph, route);
  const result: WayfindingResult = {
    route,
    steps: computed.steps.map(step => ({
      node_id: step.node_id,
      label: step.label,
      level_id: step.level_id,
      kind: step.kind,
      instruction: say(templates, step.instruction),
    })),
    total_distance_m: computed.total_distance_m,
    level_changes: computed.level_changes,
  };

  return { ok: true, value: result, warnings: [...routeResult.warnings] };
}
