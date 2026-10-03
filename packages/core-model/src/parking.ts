/**
 * L'extension d'une empreinte de place de stationnement — A5.3, section S8.
 *
 * ```sql
 * parking_space (id, org_id, footprint_id, space_kind, row_label)
 *               space_kind in ('standard','accessible','family','electric','delivery')
 * ```
 *
 * « Extension d'une empreinte de nature `parking_space`, une ligne par
 * empreinte, sur le modèle de `vertical_link` qui étend une arête. Ne porte
 * que ce que l'empreinte générique n'a pas à porter : le type de place et son
 * repère de travée. »
 *
 * **Ce que ce module portait, et ce qu'il ne porte plus.** Il portait un module
 * de stationnement entier — un parking, une place autonome, une surface non
 * couverte, un portail véhicule — écrit avant que la section S8 n'existe. S8 a
 * tranché : « Une place de stationnement est une empreinte de nature
 * `parking_space`. Un parking est une zone de nature `parking`. Ce sont les
 * objets du socle, module 01. » `parking` doublait donc `zone`, et la place
 * autonome doublait `footprint`.
 *
 * Les trois tables sont retirées, et ce qu'elles portaient a trouvé sa place :
 *
 * | Ce qui était porté | Où il est passé |
 * | --- | --- |
 * | Géométrie et nom d'un parking | La zone de nature `parking` et ses empreintes |
 * | Capacité annoncée | Fait `parking.capacity` ciblant la zone (A5.11) |
 * | Gratuité | Fait `parking.free` ciblant la zone |
 * | Géométrie d'une place | L'empreinte de nature `parking_space` |
 * | Surface non numérisée | Fait `parking.undigitized_spaces` ciblant l'empreinte (S-37) |
 * | Type de place, repère de travée | Ce qui reste ici |
 * | Portail véhicule | Rien : le besoin est au registre, il revient avec les accès de livraison |
 *
 * **Le statut d'objet disparaît avec les tables.** `parking` et l'ancienne
 * `parking_space` portaient chacune un statut et une source, ce qu'aucune
 * entité d'A5.2 ne fait. A5.11 le dit sans ambiguïté : « un objet dessiné qui
 * n'existe pas encore porte le sien sur l'objet, **là où le modèle le
 * déclare** ». `zone` et `footprint` ne le déclarent nulle part, et l'ajouter
 * serait un choix de modèle qu'A5 ne prévoit pas. Ce qu'un statut d'objet
 * disait de publiable se dit désormais du fait, où A5.11 le pose.
 */

/**
 * Le type d'une place — A5.3.
 *
 * Cinq valeurs, celles du document. L'ancienne liste en comptait trois, en
 * français (`standard`, `pmr`, `livraison`) ; A5.3 les nomme en anglais comme
 * tout autre énuméré du modèle, et ajoute la place familiale et la place
 * électrique.
 */
export type ParkingSpaceKind =
  | 'standard' | 'accessible' | 'family' | 'electric' | 'delivery';

export const PARKING_SPACE_KINDS: readonly ParkingSpaceKind[] = [
  'standard', 'accessible', 'family', 'electric', 'delivery',
];

export function isParkingSpaceKind(value: string): value is ParkingSpaceKind {
  return (PARKING_SPACE_KINDS as readonly string[]).includes(value);
}

/**
 * Ce qu'une empreinte de place porte en plus des autres empreintes.
 *
 * Une ligne par empreinte : `footprint_id` est la clé du rattachement, et
 * l'unicité est tenue en base. Une empreinte de place sans extension reste une
 * place — de type standard, sans repère de travée — comme une arête sans
 * `vertical_link` reste une arête.
 */
export type ParkingSpace = {
  readonly id: string;
  readonly org_id: string;
  readonly footprint_id: string;
  readonly space_kind: ParkingSpaceKind;
  /** Rangée ou travée, telle qu'elle est repérée sur le plan source. */
  readonly row_label: string;
};
