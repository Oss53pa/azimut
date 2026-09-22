/**
 * S5 (partie N) — « L'historique d'occupation est conservé. Une cellule qui
 * change d'occupant ne perd pas la trace du précédent, ce qui alimente les
 * modules 03 et 09. »
 *
 * Les colonnes existent depuis la migration `0020` et la contrainte refuse
 * déjà une période renversée. Ce qui manquait est la lecture : sans elle, la
 * trace est conservée sans être consultable, et le critère 4 de N1.7 —
 * « l'historique survit à trois changements successifs sur une même cellule »
 * — n'a rien à vérifier.
 *
 * Aucune horloge ici, conformément à A4.1 : la date à laquelle on se place est
 * toujours un paramètre.
 */
import type { Destination } from './site.js';

/** Une date ISO 8601 `AAAA-MM-JJ`. L'ordre lexicographique y est l'ordre réel. */
export type IsoDate = string;

/**
 * Les occupations successives d'une cellule, de la plus ancienne à la plus
 * récente.
 *
 * Ordre : `valid_from` croissant, une entrée non relevée passant en premier
 * puisqu'elle précède nécessairement ce qui est daté. Départage final par
 * identifiant, sans quoi deux occupations de même date sortiraient dans un
 * ordre variable — A9 l'interdit.
 */
export function occupancyHistory(
  destinations: readonly Destination[],
  footprintId: string,
): readonly Destination[] {
  return destinations
    .filter(d => d.footprint_id === footprintId)
    .slice()
    .sort((a, b) => {
      const from = compareOptionalDates(a.valid_from, b.valid_from);
      return from !== 0 ? from : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    });
}

/**
 * Les occupations en vigueur à une date donnée.
 *
 * Rend une liste, et non une occupation unique : rien n'interdit en base que
 * deux périodes se recouvrent, et la contrainte de `0020` ne refuse qu'une
 * période renversée. Rendre l'une des deux reviendrait à trancher une question
 * que le cahier des charges ne tranche pas. La liste dit ce qui est, et
 * l'appelant voit le recouvrement au lieu de l'ignorer.
 */
export function occupantsOn(
  destinations: readonly Destination[],
  footprintId: string,
  on: IsoDate,
): readonly Destination[] {
  return occupancyHistory(destinations, footprintId).filter(d => isInForceOn(d, on));
}

/**
 * Une occupation est en vigueur si la date tombe dans sa période.
 *
 * Bornes incluses des deux côtés. `valid_from` absent vaut « depuis toujours »,
 * `valid_to` absent vaut « occupant en cours », ce que N1.2 dit explicitement.
 */
export function isInForceOn(destination: Destination, on: IsoDate): boolean {
  const { valid_from, valid_to } = destination;
  if (valid_from !== undefined && on < valid_from) return false;
  if (valid_to !== undefined && on > valid_to) return false;
  return true;
}

/**
 * L'occupation qui a précédé celle-ci sur la même cellule, s'il y en a une.
 *
 * C'est la lecture que le module 09 demande pour chiffrer une reprise sur
 * mutation : ce qui change, et depuis quoi.
 */
export function previousOccupancy(
  destinations: readonly Destination[],
  destinationId: string,
): Destination | null {
  const current = destinations.find(d => d.id === destinationId);
  if (current === undefined) return null;
  const history = occupancyHistory(destinations, current.footprint_id);
  const index = history.findIndex(d => d.id === destinationId);
  return index > 0 ? history[index - 1] ?? null : null;
}

/** Une entrée non relevée précède ce qui est daté. */
function compareOptionalDates(a: IsoDate | undefined, b: IsoDate | undefined): number {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return -1;
  if (b === undefined) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}
