/**
 * S8 (partie N) — « La légende et la rose des vents ne sont pas dessinées.
 * Elles sont générées depuis les catégories présentes et depuis l'orientation.
 * Seule leur position est composée. »
 *
 * E9.4 dit pourquoi : « C'est ce qui garantit qu'elle ne peut pas devenir
 * fausse, à la différence d'un fichier graphique classique. » Une légende
 * dessinée survit à la disparition de ce qu'elle légende ; une légende dérivée
 * ne le peut pas.
 *
 * Ce module ne rend rien. Il produit ce qu'il y a à montrer, et la composition
 * de page décide seulement où le poser.
 */
import { normalizeAzimuth } from './angle.js';
import type { Category, Destination, Footprint } from './site.js';

/** Une entrée de légende : la catégorie, et de quoi la désigner. */
export type LegendEntry = {
  readonly category_id: string;
  readonly code: string;
  readonly sector_key: string;
  /** Nombre de destinations de cette catégorie sur le niveau. */
  readonly count: number;
};

/**
 * La légende d'un niveau, dérivée des catégories réellement présentes.
 *
 * « Réellement présentes » se lit strictement : une catégorie déclarée au
 * catalogue mais qu'aucune destination du niveau n'emploie n'y figure pas.
 * C'est tout l'intérêt de la dérivation.
 *
 * Ordre déterministe (A9) : par code, départagé par identifiant. Aucun tri par
 * effectif, qui ferait sauter une entrée de place au moindre changement
 * d'occupant et rendrait deux impressions du même niveau différentes.
 *
 * L'entrée ne porte pas de libellé : `category` n'en a pas au modèle (A5.4).
 * Le libellé est affaire de la couche qui rend, et l'inventer ici serait
 * écrire une donnée qui n'existe pas.
 */
export function deriveLegend(
  input: {
    readonly categories: readonly Category[];
    readonly destinations: readonly Destination[];
    readonly footprints: readonly Footprint[];
  },
  levelId: string,
): readonly LegendEntry[] {
  const onLevel = new Set(
    input.footprints.filter(f => f.level_id === levelId).map(f => f.id),
  );

  const counts = new Map<string, number>();
  for (const destination of input.destinations) {
    if (!onLevel.has(destination.footprint_id)) continue;
    counts.set(destination.category_id, (counts.get(destination.category_id) ?? 0) + 1);
  }

  const entries: LegendEntry[] = [];
  for (const category of input.categories) {
    const count = counts.get(category.id);
    if (count === undefined) continue;
    entries.push({
      category_id: category.id,
      code: category.code,
      sector_key: category.sector_key,
      count,
    });
  }

  return entries.sort((a, b) => {
    if (a.code !== b.code) return a.code < b.code ? -1 : 1;
    return a.category_id < b.category_id ? -1 : a.category_id > b.category_id ? 1 : 0;
  });
}

/**
 * L'angle de la rose des vents, en convention compas (D1.3).
 *
 * D6.3 place la rose parmi les éléments que la rotation du plan n'emporte
 * pas — elle reste lisible horizontalement — mais qui « tournent sur
 * eux-mêmes pour indiquer le nord réel ». Sa rotation propre est donc celle du
 * plan : c'est ainsi que son nord tombe là où le nord du plan est tombé.
 *
 * Elle ne se dessine donc jamais à un angle choisi : elle se calcule depuis la
 * rotation appliquée à la carte, et d'elle seule.
 */
export function compassRoseAngleDeg(mapRotationDeg: number): number {
  return normalizeAzimuth(mapRotationDeg);
}

/**
 * La rotation d'un plan mural, pour un support d'azimut donné (D6.2).
 *
 * « Le plan est tourné de `-azimuth_deg` » : ce qui est devant l'usager se
 * retrouve en haut du panneau.
 */
export function mapRotationForAzimuthDeg(azimuthDeg: number): number {
  return normalizeAzimuth(-azimuthDeg);
}
