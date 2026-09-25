/**
 * Module 03 — ce que chaque profil de déplacement donne sur le graphe du site.
 *
 * Pour chaque profil, on calcule le plus court chemin de chaque entrée vers
 * chaque destination (`computeRoute`) : combien aboutissent, combien restent
 * sans solution, et de combien le parcours s'allonge par rapport au profil de
 * référence, le premier déclaré. Aucune vitesse ni aucun temps : le modèle
 * n'en porte pas, et une vitesse de marche serait une valeur normative (INV-5).
 */
import type { SiteData, TravelProfile } from '@azimut/core-model';
import { computeRoute } from '@azimut/engine-graph';

export type ProfileRoutes = {
  readonly profileId: string;
  /** Couples entrée → destination considérés. */
  readonly pairs: number;
  readonly solved: number;
  readonly unsolved: number;
  /**
   * Allongement moyen par rapport au profil de référence, en fraction
   * (0,18 pour +18 %), sur les couples que les deux profils résolvent ;
   * `null` pour le profil de référence lui-même ou sans couple commun.
   */
  readonly meanDetour: number | null;
};

function lengths(site: SiteData, profile: TravelProfile): Map<string, number | null> {
  const out = new Map<string, number | null>();
  const origins = site.graph.nodes.filter(n => n.kind === 'entrance').sort((a, b) => a.id.localeCompare(b.id));
  const destinations = [...site.destinations].sort((a, b) => a.id.localeCompare(b.id));
  for (const origin of origins) {
    for (const destination of destinations) {
      if (destination.node_id === origin.id) continue;
      const route = computeRoute(site, profile, origin.id, destination.node_id);
      out.set(`${origin.id}→${destination.id}`, route.ok ? route.value.cost : null);
    }
  }
  return out;
}

export function profileRoutes(site: SiteData): readonly ProfileRoutes[] {
  const reference = site.travel_profiles[0];
  const referenceLengths = reference === undefined ? new Map<string, number | null>() : lengths(site, reference);

  return site.travel_profiles.map((profile): ProfileRoutes => {
    const own = profile.id === reference?.id ? referenceLengths : lengths(site, profile);
    let solved = 0;
    let ratioSum = 0;
    let compared = 0;
    for (const [pair, length] of own) {
      if (length === null) continue;
      solved += 1;
      const base = referenceLengths.get(pair);
      if (profile.id !== reference?.id && base !== undefined && base !== null && base > 0) {
        ratioSum += length / base - 1;
        compared += 1;
      }
    }
    return {
      profileId: profile.id,
      pairs: own.size,
      solved,
      unsolved: own.size - solved,
      meanDetour: compared === 0 ? null : ratioSum / compared,
    };
  });
}
