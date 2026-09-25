import type { SiteData, Footprint, Pictogram } from './site.js';
import { isParkingZone, isParkingSpaceFootprint } from './site.js';
import type { SiteFact } from './site-facts.js';
import { declaredInteger, PARKING_UNDIGITIZED_SPACES_KEY } from './fact-keys.js';

/**
 * Ce qu'un rendu doit savoir des places de stationnement d'un niveau — S-39.
 *
 * « Rendu d'une place de stationnement, dans toutes les vues : plan de niveau
 * et plan orienté, contour léger, sans libellé ; place accessible, pictogramme
 * normalisé du registre de sécurité, jamais un symbole maison ; vue
 * isométrique, la place reste au sol, sans volume ; plan d'évacuation, elle
 * n'y apparaît pas, sauf si elle porte un cheminement d'évacuation. »
 *
 * Quatre vues, une même lecture des données. La poser ici évite que chacune
 * décide pour elle-même ce qu'est une place, et que les quatre divergent au
 * premier changement.
 *
 * **Une place est déclarée, jamais devinée.** Une empreinte de nature
 * `parking_space` qu'aucune zone de nature `parking` ne déclare n'en est pas
 * une pour un rendu : A5.2 veut l'appartenance déclarée et non calculée, et
 * `DATA.PARKING_SPACE_WITHOUT_ZONE` est là pour signaler l'oubli. Un plan qui
 * devinerait le rattachement masquerait précisément ce que ce contrôle dit.
 */
export type ParkingSpaceView = {
  /** Les empreintes de place du niveau, déclarées par une zone de parking. */
  readonly spaces: ReadonlySet<string>;
  /** Celles dont l'extension d'A5.3 dit qu'elles sont accessibles. */
  readonly accessible: ReadonlySet<string>;
  /** Celles qu'un fait `parking.undigitized_spaces` marque non numérisées (S-37). */
  readonly undigitised: ReadonlySet<string>;
};

export const ACCESSIBLE_SPACE_KIND = 'accessible';

/** La vue vide : aucun parking sur ce niveau. */
export const NO_PARKING_SPACES: ParkingSpaceView = {
  spaces: new Set(),
  accessible: new Set(),
  undigitised: new Set(),
};

export function parkingSpacesOfLevel(
  site: SiteData,
  levelId: string,
  facts: readonly SiteFact[],
): ParkingSpaceView {
  const declared = new Set((site.zones ?? [])
    .filter(zone => isParkingZone(zone.kind) && zone.level_id === levelId)
    .flatMap(zone => [...zone.footprint_ids]));

  const spaces = new Set(site.footprints
    .filter(footprint => footprint.level_id === levelId
      && isParkingSpaceFootprint(footprint.kind)
      && declared.has(footprint.id))
    .map(footprint => footprint.id));

  const accessible = new Set(site.parking_spaces
    .filter(extension => extension.space_kind === ACCESSIBLE_SPACE_KIND
      && spaces.has(extension.footprint_id))
    .map(extension => extension.footprint_id));

  const undigitised = new Set([...spaces].filter(id =>
    declaredInteger(facts, PARKING_UNDIGITIZED_SPACES_KEY,
      { kind: 'footprint', id }) !== null));

  return { spaces, accessible, undigitised };
}

/**
 * Ce qu'un rendu de plan lit en plus de `SiteData`.
 *
 * Les faits d'A5.11 vivent dans le vocabulaire du site, non dans la scène : un
 * moteur qui les veut les reçoit. Le pictogramme normalisé suit la même voie,
 * et pour une raison plus forte — voir ci-dessous.
 */
export type PlanContext = {
  readonly facts?: readonly SiteFact[];
  /**
   * Le pictogramme normalisé d'une place accessible — S-39.
   *
   * Passé en donnée, et non choisi par le moteur. S-39 exige « le pictogramme
   * normalisé du registre de sécurité, jamais un symbole maison » ; désigner
   * lequel est une valeur d'origine normative, que INV-5 interdit d'écrire
   * dans le code et qui doit venir d'un paquet de règles. Le moteur dessine ce
   * qu'on lui donne, et l'appelant répond de sa provenance.
   *
   * Absent, aucune marque n'est dessinée. C'est le seul repli que S-39 laisse :
   * inventer un symbole est expressément interdit, et un symbole approchant le
   * serait tout autant.
   */
  readonly accessible_space_pictogram?: Pictogram;
};

/**
 * Le tracé du pictogramme à employer pour une place accessible, ou `null`.
 *
 * Rend `null` pour un pictogramme d'un autre registre : INV-3 cloisonne le
 * registre de sécurité, et S-39 y renvoie explicitement. Un pictogramme
 * d'orientation, fût-il bien dessiné, n'est pas celui que la règle demande.
 */
export function accessibleSpaceMark(context: PlanContext): Pictogram | null {
  const picto = context.accessible_space_pictogram;
  if (picto === undefined || picto.registry !== 'safety') return null;
  return picto.svg_path.trim() === '' ? null : picto;
}

/**
 * Le côté du carré dans lequel un tracé de pictogramme est exprimé.
 *
 * Convention de dessin du dépôt, et non une valeur d'origine normative : les
 * tracés de `pictogram.svg_path` sont écrits dans ce carré, et `render-face`
 * les met à l'échelle de la même façon. A5.4 et J5.4 posent la vraie grille de
 * construction sur la famille de pictogrammes, que le modèle ne porte pas
 * encore ; le jour où elle y sera, c'est elle qu'il faudra lire.
 */
export const PICTOGRAM_GRID_UNITS = 30;

/** Le centre de l'enveloppe d'une empreinte, où se pose sa marque. */
export function footprintCentre(
  footprint: Footprint,
): { readonly x_m: number; readonly y_m: number } | null {
  const vertices = footprint.geometry.vertices;
  if (vertices.length === 0) return null;
  const xs = vertices.map(v => v.x_m);
  const ys = vertices.map(v => v.y_m);
  return {
    x_m: (Math.min(...xs) + Math.max(...xs)) / 2,
    y_m: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
}
