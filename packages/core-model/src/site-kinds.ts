/**
 * Les énumérés fermés du socle : natures d'empreinte, de zone et d'ouverture.
 * Sortis de `site.ts` pour tenir la limite de taille des fichiers ; `site.ts`
 * les réexporte, leurs importeurs n'ont pas changé.
 */

/**
 * N1.2 — natures d'empreinte, énuméré fermé.
 *
 * La liste fait foi : une nature hors liste n'est pas représentable. La base
 * porte la même contrainte par un CHECK (migration 0019), comme pour toute
 * autre énumération du schéma — `node.kind`, `vertical_link.kind`,
 * `destination.occupancy_status`. Un test structurel vérifie que les deux
 * listes coïncident.
 *
 * Conséquence assumée pour les imports : une nature étrangère doit être
 * traduite vers l'une de ces cinq, ou refusée avec un code. Elle ne peut plus
 * être portée telle quelle jusqu'au modèle, où elle échappait à tout contrôle.
 */
export const FOOTPRINT_KINDS = [
  'cell',
  'circulation',
  'technical',
  'vertical_core',
  'outdoor',
] as const;

export type FootprintKind = (typeof FOOTPRINT_KINDS)[number];

/**
 * Restreint une chaîne venue de l'extérieur — base, import, fichier — à une
 * nature connue. À employer à toute frontière qui reçoit du texte libre.
 */
export function isFootprintKind(value: string): value is FootprintKind {
  return (FOOTPRINT_KINDS as readonly string[]).includes(value);
}

/**
 * A5.2 — natures de zone, énuméré fermé.
 *
 * Une zone du socle est une division technique du niveau. Elle ne se confond
 * pas avec la zone d'orientation du module 02, qui a sa table et ses propres
 * natures : un même espace peut relever de deux zones d'orientation selon le
 * parcours, ce qu'une zone du socle ne permet pas.
 */
export const ZONE_KINDS = [
  'commercial',
  'food',
  'service',
  'technical',
  'parking',
  'outdoor',
] as const;

export type SiteZoneKind = (typeof ZONE_KINDS)[number];

export function isSiteZoneKind(value: string): value is SiteZoneKind {
  return (ZONE_KINDS as readonly string[]).includes(value);
}

/** A5.2 — natures d'ouverture, énuméré fermé. */
export const OPENING_KINDS = [
  'door',
  'automatic_door',
  'emergency_door',
  'shop_front',
  'bay',
] as const;

export type OpeningKind = (typeof OPENING_KINDS)[number];

export function isOpeningKind(value: string): value is OpeningKind {
  return (OPENING_KINDS as readonly string[]).includes(value);
}

/** Nature portant un code d'unité obligatoire (règle M01.S3). */
export const CELL_FOOTPRINT_KIND = 'cell';

/** Vrai pour une empreinte de cellule, seule nature que M01.S3 contraint. */
export function isCellFootprint(kind: FootprintKind): boolean {
  return kind === CELL_FOOTPRINT_KIND;
}
