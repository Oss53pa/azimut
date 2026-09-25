import type { Polygon } from './geometry.js';

/**
 * Stationnement — A5.11, règle M01.S11.
 *
 * Le socle ne portait rien du stationnement : ni parking, ni place, ni portail.
 * Un plan d'accueil qui dit « parking Ouest, 89 places » lisait donc un chiffre
 * saisi quelque part, sans rien pour le rattacher au plan qui le fonde.
 *
 * Ces objets portent un statut et une source, ce qu'aucune entité du socle ne
 * fait aujourd'hui. Le retrofit de A5 est un autre sujet ; ici la place était
 * libre, et la prendre coûtait moins que de la laisser.
 *
 * **Le statut d'un objet n'est pas celui d'un fait, et A5.11 le dit.** « Un
 * fait déclaré, par exemple la capacité annoncée d'un parking, porte son
 * statut sur `site_fact`. Un objet dessiné qui n'existe pas encore, par
 * exemple une place de stationnement en projet, porte le sien sur l'objet, là
 * où le modèle le déclare. Les deux obéissent à la même règle, un objet ou un
 * fait de statut `proposal` ne s'affiche jamais comme un existant, et ils ne
 * se confondent pas : rassembler les deux sur une seule table ne gagnerait
 * rien. » Ce module porte donc le second des deux, et c'est sa place.
 *
 * Écart qui subsiste, et qui est d'une autre nature : A5.11 ne décrit ni
 * `parking`, ni `parking_space`, ni leur géométrie. Ces objets restent hors du
 * cahier des charges, et Q2 ne les attribue à aucun module.
 */

/**
 * D'où vient l'objet, et ce qu'il vaut.
 *
 * Quatre valeurs, là où le statut d'un fait d'A5.11 en compte trois. La
 * quatrième, `retire`, n'a pas d'équivalent, et n'a pas à en avoir un : A5.11
 * dit ce qu'une déclaration vaut, non ce qu'un objet devient quand il
 * disparaît du plan. C'est l'une des raisons pour lesquelles la section refuse
 * de rassembler les deux statuts sur une seule table.
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

/**
 * Un objet retiré ne compte plus, quoi qu'on lui demande.
 *
 * Distinct de `PUBLISHABLE_STATUSES`, et la nuance porte. Deux questions
 * différentes se posent au même jeu de places :
 *
 * - « le plan a-t-il été numérisé ? » compte tout ce qui a été tracé, y compris
 *   une proposition non validée : elle est sur le plan, quelqu'un l'a vue ;
 * - « combien de places ce parking a-t-il ? », posée par un livrable, ne compte
 *   que l'existant, parce que publier une proposition la transforme en fait
 *   (A5.11, règle M01.S11).
 *
 * Seul le retiré tombe des deux côtés.
 */
export function countsAsDigitised(status: ObjectStatus): boolean {
  return status !== 'retire';
}

export type Provenance = {
  readonly status: ObjectStatus;
  /** Le plan, le relevé ou la décision qui fonde l'objet. Jamais vide : contrainte en base. */
  readonly source: string;
};

export type ParkingSpaceKind = 'standard' | 'pmr' | 'livraison';

export type ParkingSpace = {
  readonly id: string;
  readonly org_id: string;
  readonly parking_id: string;
  /**
   * Tracé de la place sur le plan source, quand il est relevé.
   *
   * Facultatif, et la raison est une question ouverte : le cahier des charges
   * ne décrit pas la géométrie d'une place, et le modèle ne porte que
   * `Polygon`. Un emplacement marqué d'un seul trait n'est pas un polygone, et
   * le forcer à l'être inventerait une géométrie que le plan ne montre pas.
   * Tant que la forme n'est pas tranchée, la place peut exister sans tracé.
   */
  readonly geometry?: Polygon;
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
 * Sans cette déclaration, un parking à demi numérisé serait indiscernable d'un
 * parking numérisé en entier et à demi vide. Rien n'est complété par
 * extrapolation : c'est la discipline de la règle M01.S11, « un nombre affiché
 * dans un livrable provient d'un fait ou d'un calcul », appliquée à la limite
 * du relevé. Le cahier des charges ne décrit pas cet objet ; il en donne la
 * raison d'être.
 */
export type UncoveredArea = {
  readonly id: string;
  readonly org_id: string;
  readonly parking_id: string;
  /**
   * Étendue de la zone sur le plan, quand on sait la tracer.
   *
   * Facultative pour la même raison qu'un plan s'arrête de deux façons : parfois
   * on sait où — le bord de page passe ici — et parfois on sait seulement que
   * le relevé est incomplet, sans pouvoir en dessiner la limite. Exiger le tracé
   * empêcherait de déclarer le second cas, qui est celui où le silence est le
   * plus dangereux.
   */
  readonly geometry?: Polygon;
  /** Pourquoi le plan s'arrête : bord de page, calque absent, zone illisible. */
  readonly reason: string;
};
