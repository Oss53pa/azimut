import type { Finding, Level, Outcome, TravelProfile } from '@azimut/core-model';
import { codePointCompare } from '@azimut/core-model';
import { computeRoute, deriveDecisionPoints, renderRouteAnimation, routeSteps } from '@azimut/engine-graph';
import type { RouteAnimation, RouteAnimationOptions, RouteStep } from '@azimut/engine-graph';
import type { SessionState, StoredRow } from './session-store.js';
import { rowsOf } from './session-store.js';
import { readSessionGraph } from './session-graph.js';
import { graphScopeFromSession } from './session-scope.js';
import { boolean, structured, text } from './row-values.js';

/**
 * L3.1 (partie L) et A7.3 — le parcours d'un visiteur, vu dans l'atelier du
 * graphe : d'un nœud à un autre, pour un profil de parcours du site.
 *
 * Le chemin vient de `computeRoute` (A7.1), les points de décision de
 * `deriveDecisionPoints`, le rendu de `renderRouteAnimation` : l'atelier ne
 * trace rien lui-même (INV-1). Aucun profil n'est inventé : un site qui n'en
 * déclare pas le dit, et le parcours ne se calcule pas.
 */
function stringList(raw: unknown): readonly string[] | null {
  const value: unknown = typeof raw === 'string' ? safeParse(raw) : raw;
  if (!Array.isArray(value) || !value.every((v): v is string => typeof v === 'string')) return null;
  return value;
}

function safeParse(raw: string): unknown {
  try { return JSON.parse(raw); } catch { return null; }
}

function readProfile(row: StoredRow): TravelProfile | null {
  const key = text(row.values, 'key');
  const excluded = stringList(structured(row.values, 'excluded_edge_kinds') ?? []);
  if (key === null || excluded === null) return null;
  return {
    id: row.id,
    org_id: text(row.values, 'org_id') ?? '',
    site_id: text(row.values, 'site_id') ?? '',
    key,
    name: text(row.values, 'name') ?? key,
    excluded_edge_kinds: excluded,
    require_accessible: boolean(row.values, 'require_accessible'),
    honor_hours: boolean(row.values, 'honor_hours'),
  };
}

/** Les profils de parcours que la session porte, dans l'ordre de leur clé. */
export function profilesOfSession(state: SessionState): readonly TravelProfile[] {
  return rowsOf(state, 'travel_profile')
    .map(readProfile)
    .filter((p): p is TravelProfile => p !== null)
    .sort((a, b) => codePointCompare(a.key, b.key) || codePointCompare(a.id, b.id));
}

export type PlannedRoute = {
  readonly animation: RouteAnimation;
  readonly levels: readonly Level[];
  /** Le type de chaque nœud du chemin : il dit le moyen d'un changement de niveau. */
  readonly nodeKinds: ReadonlyMap<string, string>;
  readonly cost: number;
  /** Partie P, écran Itinéraire — les étapes écrites, sous forme neutre : l'interface les dit. */
  readonly steps: readonly RouteStep[];
  readonly totalDistance_m: number;
};

/** Le parcours de `from` à `to` pour un profil, prêt à montrer. */
export function planRoute(
  state: SessionState, profile: TravelProfile, from: string, to: string, options: RouteAnimationOptions,
): Outcome<PlannedRoute> {
  const graph = readSessionGraph(state);
  const site = {
    graph: { nodes: graph.nodes, edges: graph.edges, vertical_links: graph.vertical_links, building_links: graph.building_links },
    temporary_closures: [],
  };
  const route = computeRoute(site, profile, from, to);
  if (!route.ok) return route;
  const decisions = deriveDecisionPoints(site, profile, []);
  const decisionIds = decisions.ok ? decisions.value.map(d => d.node_id) : [];
  const { scope } = graphScopeFromSession(state);
  const animation = renderRouteAnimation(
    route.value, { nodes: graph.nodes, levels: scope.levels, footprints: scope.footprints }, decisionIds, options,
  );
  if (!animation.ok) return animation;
  const warnings: Finding[] = [...route.warnings, ...animation.warnings];
  const steps = routeSteps(site.graph, route.value);
  return {
    ok: true,
    value: {
      animation: animation.value,
      levels: scope.levels,
      nodeKinds: new Map(graph.nodes.map(n => [n.id, n.kind])),
      cost: route.value.cost,
      steps: steps.steps,
      totalDistance_m: steps.total_distance_m,
    },
    warnings,
  };
}
