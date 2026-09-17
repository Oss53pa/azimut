import type { Polygon } from './geometry.js';

/**
 * Stationnement — complément atelier, M2.
 *
 * Le socle ne portait rien du stationnement : ni parking, ni place, ni portail.
 * Un plan d'accueil qui dit « parking Ouest, 89 places » lisait donc un chiffre
 * saisi quelque part, sans rien pour le rattacher au plan qui le fonde.
 *
 * Ces objets portent un statut et une source, ce qu'aucune entité du socle ne
 * fait aujourd'hui (P1). Le retrofit de A5 est un autre sujet ; ici la place
 * était libre, et la prendre coûtait moins que de la laisser.
 */

/**
 * P1 — d'où vient l'objet, et ce qu'il vaut.
 *
 * `proposition` désigne ce qu'une détection assistée a suggéré et que personne
 * n'a validé. `a_verifier` désigne ce qu'on a relevé sans pouvoir le confirmer.
 * La distinction porte : la première se rejette, la seconde se vérifie.
 *
 * `retire` reste en base et sort des livrables : l'historique d'un objet
 * supprimé est ce qui permet de dire pourquoi il l'a été.
 */
export type ObjectStatus = 'existant' | 'proposition' | 'a_verifier' | 'retire';

/** Statuts qu'un livrable a le droit de montrer comme un fait. */
export const PUBLISHABLE_STATUSES: readonly ObjectStatus[] = ['existant'];

export type Provenance = {
  readonly status: ObjectStatus;
  /** Le plan, le relevé ou la décision qui fonde l'objet. Jamais vide (P1). */
  readonly source: string;
};

export type ParkingSpaceKind = 'standard' | 'pmr' | 'livraison';

export type ParkingSpace = {
  readonly id: string;
  readonly org_id: string;
  readonly parking_id: string;
  readonly kind: ParkingSpaceKind;
  /** Rangée ou travée, telle qu'elle est repérée sur le plan source. */
  readonly row: string;
  readonly provenance: Provenance;
};

export type Parking = {
  readonly id: string;
  readonly org_id: string;
  readonly level_id: string;
  /** Emprise du parking, en coordonnées métier (D1.1). */
  readonly geometry: Polygon;
  readonly name: string;
  readonly free: boolean;
  /**
   * Capacité annoncée par la source. Elle n'est pas le nombre de places
   * numérisées, et c'est tout l'intérêt de la garder à part : leur écart est
   * précisément ce qu'il faut voir.
   */
  readonly declared_capacity: number;
  readonly provenance: Provenance;
};

/**
 * Là où le plan source s'arrête.
 *
 * M2 l'exige : « Là où le plan source s'arrête, la zone est marquée non
 * couverte ; Azimut ne complète pas par extrapolation. » Sans cette
 * déclaration, un parking à demi numérisé serait indiscernable d'un parking
 * numérisé en entier et à demi vide.
 */
export type UncoveredArea = {
  readonly id: string;
  readonly org_id: string;
  readonly parking_id: string;
  /** Pourquoi le plan s'arrête : bord de page, calque absent, zone illisible. */
  readonly reason: string;
};
