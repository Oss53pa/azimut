/**
 * Faits du site et mots qu'ils interdisent — complément atelier, M3.
 *
 * Un fait du site est une affirmation vérifiée qui conditionne ce qu'on écrit :
 * le parking est gratuit, le site compte deux niveaux de parking, il n'y a pas
 * de barrière. Chaque fait porte sa valeur, sa source et sa date, parce qu'une
 * affirmation sans provenance ne se conteste pas.
 *
 * Il porte aussi les mots que sa véracité bannit. « Parking gratuit » interdit
 * paiement, payant, tarif, caisse de parking. Ce n'est pas une question de
 * style, contrairement au lexique de charte : c'est une contradiction entre ce
 * que le site est et ce qu'un livrable en dit.
 *
 * Les deux contrôles partagent le même appariement, et ne partagent que lui.
 * Un terme de charte se corrige en reformulant ; un mot contredisant un fait se
 * corrige en reformulant **ou** en révisant le fait, et l'anomalie doit donc
 * nommer le fait pour que ce second chemin reste visible.
 */

/** Un mot interdit, et la langue où il l'est. */
export type ForbiddenWord = {
  readonly lang: string;
  readonly term: string;
};

export type SiteFact = {
  /** Clé stable du fait : `parking_gratuit`, `niveaux_parking`. */
  readonly key: string;
  readonly value: string;
  /** D'où vient l'affirmation : plan, relevé, décision de la Direction. */
  readonly source: string;
  /** Date de la constatation, en ISO 8601. */
  readonly recorded_on: string;
  readonly forbidden: readonly ForbiddenWord[];
};
