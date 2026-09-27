/**
 * A5.3 — la disponibilité d'une arête (`edge.availability`), et les
 * fermetures qu'elle porte (proposition de schéma, 4.1).
 *
 * Forme en base, décidée le 26/09/2026 :
 *
 *   { "closures": [ { "from": "2026-10-12T00:00:00", "to": "2026-10-16T23:59:59",
 *                     "reason_key": "works", "declared_by": "<membership.id>" } ] }
 *
 * Les bornes sont en heure locale du site (O4), sans décalage, bornes
 * incluses ; deux instants de ce format se comparent comme des chaînes.
 *
 * Une fermeture ne compte qu'à un instant donné (décision du même jour) : le
 * calcul d'itinéraire la voit s'il reçoit un instant, et seulement alors.
 * Les rendus imprimés et durables ne la voient pas.
 *
 * Une disponibilité illisible n'est pas écartée : elle est gardée comme
 * telle, un contrôle la signale, et à un instant donné l'arête compte pour
 * fermée — on ne peut pas prouver qu'elle est ouverte.
 */

export type EdgeClosure = {
  /** Début, heure locale du site `AAAA-MM-JJTHH:MM:SS`, inclus. */
  readonly from: string;
  /** Fin, même format, incluse. */
  readonly to: string;
  /** Motif, traduit par l'interface quand elle le connaît. */
  readonly reason_key: string;
  /** Auteur de la déclaration (`membership.id`), ou `null`. */
  readonly declared_by: string | null;
};

export type EdgeAvailability =
  | { readonly readable: true; readonly closures: readonly EdgeClosure[] }
  | { readonly readable: false };

/**
 * Les motifs d'une fermeture, en liste fermée (décision du 26/09/2026).
 * Un motif hors liste lu en base n'est pas rejeté : l'interface l'affiche
 * tel quel ; le formulaire, lui, n'en propose pas d'autre.
 */
export const CLOSURE_REASONS = ['works', 'event', 'security', 'maintenance', 'other'] as const;
export type ClosureReason = (typeof CLOSURE_REASONS)[number];

export function isClosureReason(value: string): value is ClosureReason {
  return (CLOSURE_REASONS as readonly string[]).includes(value);
}

const LOCAL_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

/** Vrai d'un instant au format local du site, `AAAA-MM-JJTHH:MM:SS`. */
export function isLocalInstant(value: string): boolean {
  return LOCAL_INSTANT.test(value);
}

function readClosure(value: unknown): EdgeClosure | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const c = value as Readonly<Record<string, unknown>>;
  const { from, to, reason_key: reason, declared_by: by } = c;
  if (typeof from !== 'string' || !isLocalInstant(from)) return null;
  if (typeof to !== 'string' || !isLocalInstant(to) || to < from) return null;
  if (typeof reason !== 'string' || reason.trim() === '') return null;
  if (by !== undefined && by !== null && typeof by !== 'string') return null;
  return { from, to, reason_key: reason, declared_by: typeof by === 'string' ? by : null };
}

/**
 * Lit la colonne telle que la base la rend. `undefined` pour une colonne
 * vide ; une valeur dont une seule fermeture est illisible est illisible en
 * entier, pour qu'aucune fermeture ne se perde en silence.
 */
export function readEdgeAvailability(value: unknown): EdgeAvailability | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) return { readable: false };
  const closures = (value as Readonly<Record<string, unknown>>)['closures'];
  if (closures === undefined) return { readable: true, closures: [] };
  if (!Array.isArray(closures)) return { readable: false };
  const read = closures.map(readClosure);
  if (read.some(c => c === null)) return { readable: false };
  const valid = read.filter((c): c is EdgeClosure => c !== null)
    .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  return { readable: true, closures: valid };
}

/**
 * Vrai si l'arête est fermée à l'instant donné (heure locale du site). Une
 * disponibilité illisible compte pour fermée ; une arête sans disponibilité
 * est ouverte.
 */
export function isClosedAt(availability: EdgeAvailability | undefined, at: string): boolean {
  if (availability === undefined) return false;
  if (!availability.readable) return true;
  return availability.closures.some(c => c.from <= at && at <= c.to);
}

/** Les fermetures qui recouvrent la plage donnée, bornes incluses. */
export function closuresOverlapping(
  availability: EdgeAvailability | undefined,
  from: string,
  to: string,
): readonly EdgeClosure[] {
  if (availability === undefined || !availability.readable) return [];
  return availability.closures.filter(c => c.from <= to && from <= c.to);
}
