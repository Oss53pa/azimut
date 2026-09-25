import type { SiteData, Footprint, Pictogram } from './site.js';
import { isParkingZone, isParkingSpaceFootprint } from './site.js';
import type { SiteFact } from './site-facts.js';
import { declaredInteger, PARKING_UNDIGITIZED_SPACES_KEY } from './fact-keys.js';
import {
  ACCESSIBLE_FUNCTION_KEY, resolvePictogramFunction, pictogramFunctionFinding,
} from './pictogram-functions.js';
import type { Finding } from './outcome.js';

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
 * moteur qui les veut les reçoit.
 *
 * Le pictogramme d'une place accessible, lui, n'y figure plus. Il y a figuré
 * tant qu'INV-5 empêchait le moteur de le nommer : désigner le pictogramme
 * normalisé était une valeur d'origine normative, et le moteur dessinait ce
 * qu'on lui donnait sans pouvoir en répondre. A5.4 a tranché autrement — le
 * moteur nomme la fonction, la donnée nomme le pictogramme — et le passer en
 * contexte rouvrirait la porte que la désignation ferme : un appelant y
 * glisserait le symbole de son choix, que S-39 refuse en toutes lettres.
 */
export type PlanContext = {
  readonly facts?: readonly SiteFact[];
};

/**
 * Ce qu'un rendu tire de la demande de marque d'une place accessible — S-39.
 *
 * Deux champs plutôt qu'un : le pictogramme quand la fonction est désignée, et
 * ce que la résolution oppose sinon. Les deux sont utiles ensemble — la règle
 * veut que la marque soit omise **et signalée**, donc qu'un rendu sans marque
 * ne soit pas un rendu silencieux.
 */
export type AccessibleMark = {
  /** Le pictogramme à dessiner, ou `null` : la marque est alors omise. */
  readonly pictogram: Pictogram | null;
  /** L'anomalie à porter au rendu, ou `null` si la fonction est désignée. */
  readonly finding: Finding | null;
};

/**
 * Le pictogramme de la fonction d'accessibilité, dans le registre de sécurité.
 *
 * « Place accessible : elle porte le pictogramme du registre de sécurité
 * désigné par la fonction d'accessibilité, section A5.4, jamais un symbole
 * maison, section A1.2, invariant 3. Si aucune fonction n'est désignée, la
 * marque est omise et signalée par `PICTO.FUNCTION_NOT_DESIGNATED` : le rendu
 * ne dessine jamais un pictogramme de remplacement. »
 *
 * Le registre est celui de la sécurité, et il n'est pas négociable : INV-3 le
 * cloisonne et S-39 y renvoie. Un pictogramme d'orientation qui porterait la
 * même fonction, fût-il bien dessiné, n'est pas celui que la règle demande, et
 * la résolution ne le voit même pas.
 *
 * **À n'appeler que lorsqu'une marque est demandée.** Un niveau sans place
 * accessible ne demande rien, et ne doit donc rien signaler : la fonction n'y
 * manque pas, personne ne l'a réclamée.
 */
export function accessibleSpaceMark(site: SiteData): AccessibleMark {
  const resolution = resolvePictogramFunction(
    site.pictograms, 'safety', ACCESSIBLE_FUNCTION_KEY,
  );
  const finding = pictogramFunctionFinding(
    resolution, 'safety', ACCESSIBLE_FUNCTION_KEY, 'S-39',
  );
  return {
    pictogram: resolution.kind === 'designated' ? resolution.pictogram : null,
    finding,
  };
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
