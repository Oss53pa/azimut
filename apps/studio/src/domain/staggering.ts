/**
 * H2.4 — le plan de jalonnement, parcours par parcours.
 *
 * Une séquence relie une entrée du site à une destination par le plus court
 * chemin du profil (`computeRoute`). Ses étapes sont les points de décision
 * traversés, dans l'ordre de marche, puis l'arrivée ; à chaque étape on lit,
 * dans le tableau des messages, si la destination y est annoncée. La
 * continuité est ensuite jugée par le moteur (`guardWayfindingContinuity`),
 * sur la seule destination du parcours : une autre destination annoncée sur le
 * même panneau n'est pas l'affaire de ce parcours.
 *
 * Rien n'est saisi ni enregistré : tout se recalcule depuis le graphe et le
 * tableau (INV-1), dans un ordre fixé par les identifiants (INV-4).
 */
import type { Finding, SiteData, TravelProfile } from '@azimut/core-model';
import {
  computeRoute,
  deriveDecisionPoints,
  guardWayfindingContinuity,
  type JalonnementSequence,
  type MessageSchedule,
} from '@azimut/engine-graph';

export type StaggeringStep = {
  readonly nodeId: string;
  /** `true` à l'arrivée, `false` à un point de décision. */
  readonly arrival: boolean;
  /** La destination du parcours est-elle annoncée ici ? */
  readonly announced: boolean;
};

export type StaggeringSequence = {
  readonly id: string;
  readonly originNodeId: string;
  readonly destinationId: string;
  readonly lengthM: number;
  readonly steps: readonly StaggeringStep[];
  /** Anomalies de continuité de ce parcours, telles que le moteur les rend. */
  readonly breaks: readonly Finding[];
};

export type StaggeringPlan = {
  readonly sequences: readonly StaggeringSequence[];
  /** Nombre de points de décision du profil. */
  readonly decisionPoints: number;
};

function announcedByPoint(schedule: MessageSchedule | null): ReadonlyMap<string, ReadonlySet<string>> {
  const out = new Map<string, Set<string>>();
  for (const line of schedule?.lines ?? []) {
    const set = out.get(line.decision_point_id) ?? new Set<string>();
    for (const entry of line.entries) {
      if (entry.destination_id !== null) set.add(entry.destination_id);
    }
    out.set(line.decision_point_id, set);
  }
  return out;
}

export function staggeringPlan(
  site: SiteData,
  profile: TravelProfile,
  schedule: MessageSchedule | null,
): StaggeringPlan {
  const points = deriveDecisionPoints(site, profile, site.destinations);
  const pointIds = new Set(points.ok ? points.value.map(p => p.node_id) : []);
  const announced = announcedByPoint(schedule);

  const origins = site.graph.nodes
    .filter(n => n.kind === 'entrance')
    .sort((a, b) => a.id.localeCompare(b.id));
  const destinations = [...site.destinations].sort((a, b) => a.id.localeCompare(b.id));

  const sequences: StaggeringSequence[] = [];
  for (const origin of origins) {
    for (const destination of destinations) {
      if (destination.node_id === origin.id) continue;
      const route = computeRoute(site, profile, origin.id, destination.node_id);
      if (!route.ok) continue;

      const steps: StaggeringStep[] = route.value.path
        .filter(nodeId => pointIds.has(nodeId) && nodeId !== destination.node_id)
        .map(nodeId => ({
          nodeId,
          arrival: false,
          announced: announced.get(nodeId)?.has(destination.id) ?? false,
        }));
      steps.push({ nodeId: destination.node_id, arrival: true, announced: true });

      const id = `${origin.id}→${destination.id}`;
      const sequence: JalonnementSequence = {
        id,
        steps: steps.map(step => ({
          point_id: step.nodeId,
          announced: step.announced && !step.arrival ? [destination.id] : [],
          reached: step.arrival ? [destination.id] : [],
        })),
      };
      const guarded = guardWayfindingContinuity([sequence]);
      sequences.push({
        id,
        originNodeId: origin.id,
        destinationId: destination.id,
        lengthM: route.value.cost,
        steps,
        breaks: guarded.ok ? guarded.warnings : guarded.findings,
      });
    }
  }

  return { sequences, decisionPoints: pointIds.size };
}
