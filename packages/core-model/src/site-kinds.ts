/**
 * Les énumérés fermés du socle : natures d'empreinte, de zone et d'ouverture.
 * Sortis de `site.ts` pour tenir la limite de taille des fichiers ; `site.ts`
 * les réexporte, leurs importeurs n'ont pas changé.
 */

/**
 * A5.2 — natures d'empreinte, énuméré fermé.
 *
 * La liste fait foi : une nature hors liste n'est pas représentable. La base
 * porte la même contrainte par un CHECK (migrations 0019 puis 0055), comme
 * pour toute autre énumération du schéma — `node.kind`, `vertical_link.kind`,
 * `destination.occupancy_status`. Un test structurel vérifie que les deux
 * listes coïncident.
 *
 * `parking_space` est la sixième, et elle vient de la section S8 : « Une place
 * de stationnement est une empreinte de nature `parking_space`. Un parking est
 * une zone de nature `parking`. Aucune table nouvelle : ce sont les objets du
 * socle, module 01. » Une place est donc un tracé sur un niveau, comme une
 * cellule, et non plus un objet à part.
 *
 * Deux conséquences qu'A5.2 pose et que S-37 confirme : une place n'est ni une
 * destination ni une cellule, donc elle ne porte pas de code d'unité — seule
 * `cell` en porte, règle M01.S3 — et elle n'entre dans aucun quantitatif de
 * signalétique.
 *
 * L'écran de saisie du tracé, en partie M, n'offre que quatre natures :
 * « cellule, circulation, technique, noyau vertical ». Ni `outdoor` ni
 * `parking_space` n'y figurent. Cette liste-ci est celle du modèle, la sienne
 * est celle d'un écran ; elles n'ont pas à coïncider, et le modèle ne se
 * restreint pas à ce qu'un écran donné sait produire.
 *
 * Conséquence assumée pour les imports : une nature étrangère doit être
 * traduite vers l'une de ces six, ou refusée avec un code. Elle ne peut plus
 * être portée telle quelle jusqu'au modèle, où elle échappait à tout contrôle.
 */
export const FOOTPRINT_KINDS = [
  'cell',
  'circulation',
  'technical',
  'vertical_core',
  'outdoor',
  'parking_space',
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

/**
 * S-35 — la nature d'empreinte qui porte une place de stationnement.
 *
 * Nommée plutôt que répétée en littéral : les contrôles du domaine `PARK` la
 * comparent, et une faute de frappe dans l'un d'eux ne se verrait pas — le
 * contrôle compterait zéro place et ne signalerait rien, ce qui a l'apparence
 * d'un site sain.
 */
export const PARKING_SPACE_FOOTPRINT_KIND = 'parking_space';

/** Vrai pour une empreinte de place de stationnement, section S8. */
export function isParkingSpaceFootprint(kind: FootprintKind): boolean {
  return kind === PARKING_SPACE_FOOTPRINT_KIND;
}

/**
 * S-35 — la nature de zone qui porte un parking.
 *
 * Nommée pour la même raison que la précédente, et parce que la nature de zone
 * `parking` d'A5.2 existait bien avant que la section S8 ne lui donne un sens :
 * la migration 0029 l'admettait déjà, rien ne s'en servait.
 */
export const PARKING_ZONE_KIND = 'parking';

/** Vrai pour une zone du socle portant un parking, section S8. */
export function isParkingZone(kind: SiteZoneKind): boolean {
  return kind === PARKING_ZONE_KIND;
}

/**
 * Une zone du socle — A5.2.
 *
 * Elle entre au modèle avec la version 17, qui lui donne `footprint_ids` :
 * « empreintes couvertes par la zone, appartenance déclarée et non calculée,
 * comme pour la zone d'orientation de la partie H ». Sans cette liste, une
 * zone ne portait rien et n'avait aucune raison d'être chargée ; avec elle,
 * elle porte ce qui rend `DATA.PARKING_SPACE_WITHOUT_ZONE` calculable.
 *
 * **Déclarée, non calculée.** C'est le choix inverse de celui de la règle
 * M02.W12, où l'appartenance d'un support à une zone d'orientation se calcule
 * depuis la position de son nœud. Les deux coexistent : un support est un
 * point, une empreinte est une surface, et deux surfaces qui se recouvrent
 * partiellement n'ont pas de réponse évidente. La déclarer évite d'inventer un
 * seuil de recouvrement qu'aucune section ne donne.
 *
 * Ne se confond pas avec `orientation_zone` du module 02, qui a sa table et
 * ses propres natures.
 */
export type SiteZone = {
  readonly id: string;
  readonly org_id: string;
  readonly level_id: string;
  readonly name: string;
  readonly kind: SiteZoneKind;
  /**
   * Les empreintes que la zone couvre, dans l'ordre déclaré.
   *
   * Aucune clé étrangère ne la garde : la colonne est un tableau `jsonb`. Un
   * identifiant peut donc désigner une empreinte supprimée, et c'est aux
   * contrôles de le voir, non au type de le promettre.
   */
  readonly footprint_ids: readonly string[];
};
