/**
 * O11 — les fermetures temporaires (`temporary_closure`, migration 0069).
 *
 * « Une fermeture temporaire porte une ou plusieurs arêtes, une date de
 * début, une date de fin, un motif. Pendant la fermeture, les parcours sont
 * recalculés sans ces arêtes. » Le motif est libre : O11 n'en donne pas de
 * liste.
 *
 * Les bornes sont des instants locaux du site (O4), au format
 * `AAAA-MM-JJTHH:MM:SS`, fin incluse ; deux instants de ce format se comparent
 * comme des chaînes. Un calcul ne lit jamais l'horloge (INV-4) : une
 * fermeture ne compte qu'à l'instant qu'on lui donne, et les rendus durables,
 * qui n'en reçoivent pas, ne la voient pas — O11 : la signalétique provisoire
 * « ne modifie jamais le tableau des messages nominal ».
 */
import { codePointCompare } from './empreinte.js';

export type TemporaryClosure = {
  readonly id: string;
  readonly org_id: string;
  readonly site_id: string;
  /** Les arêtes fermées, au moins une. */
  readonly edge_ids: readonly string[];
  /** Début, heure locale du site, inclus. */
  readonly from_at: string;
  /** Fin, heure locale du site, incluse. */
  readonly to_at: string;
  readonly reason: string;
};

const LOCAL_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

/** Vrai d'un instant au format local du site, `AAAA-MM-JJTHH:MM:SS`. */
export function isLocalInstant(value: string): boolean {
  return LOCAL_INSTANT.test(value);
}

/**
 * Ramène une borne lue en base au format local. PostgREST rend un
 * `timestamp` sans fuseau sous la forme `AAAA-MM-JJTHH:MM:SS`, parfois suivie
 * de fractions de seconde, qu'on retire.
 */
export function localInstantOf(value: string): string | null {
  const head = value.slice(0, 19).replace(' ', 'T');
  return isLocalInstant(head) ? head : null;
}

/** Les fermetures dans un ordre stable : début, fin, identifiant. */
export function sortClosures(closures: readonly TemporaryClosure[]): readonly TemporaryClosure[] {
  return [...closures].sort((a, b) =>
    codePointCompare(a.from_at, b.from_at) || codePointCompare(a.to_at, b.to_at) || codePointCompare(a.id, b.id));
}

/** Vrai si la fermeture est en cours à l'instant donné, bornes incluses. */
export function isActiveAt(closure: TemporaryClosure, at: string): boolean {
  return closure.from_at <= at && at <= closure.to_at;
}

/** Les arêtes fermées à l'instant donné (heure locale du site). */
export function closedEdgesAt(closures: readonly TemporaryClosure[], at: string): ReadonlySet<string> {
  const closed = new Set<string>();
  for (const closure of closures) {
    if (isActiveAt(closure, at)) for (const id of closure.edge_ids) closed.add(id);
  }
  return closed;
}

/** Les fermetures qui recouvrent la plage donnée, bornes incluses. */
export function closuresOverlapping(
  closures: readonly TemporaryClosure[],
  from: string,
  to: string,
): readonly TemporaryClosure[] {
  return closures.filter(c => c.from_at <= to && from <= c.to_at);
}
