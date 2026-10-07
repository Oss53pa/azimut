import type { Outcome, TravelProfile } from '@azimut/core-model';
import { orientationDegForAzimuth } from '@azimut/core-model';
import { deriveDecisionPoints, renderRouteAnimation } from '@azimut/engine-graph';
import type { Route, RouteAnimation, RouteAnimationOptions } from '@azimut/engine-graph';
import type { KioskSite } from './load-kiosk-site.js';

/**
 * Partie P, écran Itinéraire — le tracé animé sur le plan orienté de la borne.
 *
 * La borne connaît sa place par sa configuration locale (D10.3) : le nœud où
 * elle se trouve et l'azimut vers lequel elle regarde. Le plan est tourné
 * selon D6.2 autour de ce nœud, si bien que ce qui est devant le visiteur est
 * en haut, et le tracé s'y pose avec ses points de décision. Chaque niveau
 * traversé a son tronçon, et chaque tronçon son équivalent statique, pour le
 * mode accessible et l'animation réduite.
 *
 * Le chemin est calculé à l'exécution, puisque le visiteur choisit sa
 * destination : le tracé se compose donc ici. Il ne porte aucun pictogramme
 * (A5.8) et aucun texte (A7) ; la borne nomme les marques avec ses mots.
 * Les couleurs viennent de l'appelant, jamais d'ici.
 */
export type KioskPlacement = {
  /** D10.3 `nodeId` : le nœud du graphe où se tient la borne. */
  readonly nodeId: string;
  /** D10.3 `azimuthDeg` : la direction que regarde le visiteur, convention D1.3. */
  readonly azimuthDeg: number;
};

export type OrientedItineraryOptions = Omit<RouteAnimationOptions, 'orientation'>;

export function orientedItinerary(
  site: KioskSite,
  kiosk: KioskPlacement,
  profile: TravelProfile,
  route: Route,
  options: OrientedItineraryOptions,
): Outcome<RouteAnimation> {
  const here = site.graph.nodes.find(n => n.id === kiosk.nodeId);
  if (here === undefined) {
    return {
      ok: false,
      findings: [{
        code: 'DATA.KIOSK_CONFIG_INVALID', severity: 'blocking', entity: null,
        params: { field: 'nodeId', reason: 'unknown graph node' }, ruleRef: 'D10.3',
      }],
    };
  }
  const decisions = deriveDecisionPoints(site, profile, site.destinations);
  if (!decisions.ok) return decisions;
  return renderRouteAnimation(
    route,
    { nodes: site.graph.nodes, levels: site.levels, footprints: site.footprints },
    decisions.value.map(d => d.node_id),
    {
      ...options,
      orientation: { center: here.position, orientation_deg: orientationDegForAzimuth(kiosk.azimuthDeg) },
    },
  );
}
