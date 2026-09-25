/**
 * Faits du site et mots qu'ils interdisent — A5.11, règle M01.S11.
 *
 * « Un fait du site est une donnée déclarée qui n'appartient à aucune autre
 * table : capacité annoncée d'un parking, surface commercialisable, nombre de
 * places de livraison, tout chiffre qu'un livrable affiche et que la géométrie
 * ne produit pas. Tout fait du site porte sa source et son statut. »
 *
 * Un fait du site est donc une affirmation déclarée qui conditionne ce qu'on écrit :
 * le parking est gratuit, le site compte deux niveaux de parking, il n'y a pas
 * de barrière. Chaque fait porte sa valeur, sa source et sa date, parce qu'une
 * affirmation sans provenance ne se conteste pas, et **son statut**, parce
 * qu'« un fait de statut `proposal` ne s'affiche jamais comme un existant ».
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

/**
 * Statut d'un fait déclaré — les trois valeurs d'A5.11, et elles seules.
 *
 * `proposal` est ce qu'une source propose sans que personne l'ait arrêté.
 * `to_verify` est ce qu'on a relevé sans pouvoir le confirmer. La distinction
 * porte : la première se tranche, la seconde se vérifie.
 *
 * Aucune valeur de retrait : A5.11 n'en donne pas. Le statut d'un fait dit
 * ce que la déclaration vaut, non ce qu'un objet devient quand il disparaît du
 * plan — c'est le statut des objets de stationnement qui porte ce dernier cas.
 */
export type FactStatus = 'existing' | 'proposal' | 'to_verify';

export const FACT_STATUSES: readonly FactStatus[] = ['existing', 'proposal', 'to_verify'];

/**
 * Statuts qu'un livrable a le droit de montrer comme un fait.
 *
 * « Un fait de statut `proposal` ne s'affiche jamais comme un existant. »
 * `to_verify` tombe du même côté, et pour une raison plus forte encore : une
 * valeur qu'on n'a pas pu confirmer, affichée sans réserve, se lit comme une
 * valeur confirmée.
 */
export const PUBLISHABLE_FACT_STATUSES: readonly FactStatus[] = ['existing'];

/**
 * Valeur d'un fait.
 *
 * A5.11 la stocke en `jsonb`, et les trois exemples qu'elle nomme — capacité
 * annoncée, surface commercialisable, nombre de places de livraison — sont des
 * scalaires. Le modèle retient donc les trois scalaires de JSON. Une valeur
 * structurée, tableau ou objet, entre comme sa sérialisation canonique : rien
 * n'en produit aujourd'hui, et la rendre en texte ne perd pas la donnée,
 * là où la refuser perdrait le fait entier.
 */
export type FactValue = string | number | boolean;

export type SiteFact = {
  /** Clé stable du fait : `parking_gratuit`, `niveaux_parking`. */
  readonly key: string;
  readonly value: FactValue;
  /** A5.11 — ce que la déclaration vaut. Requis : il n'y a pas de statut par défaut. */
  readonly status: FactStatus;
  /** D'où vient l'affirmation : plan, relevé, décision de la Direction. */
  readonly source_ref: string;
  /** Date de la déclaration, en ISO 8601. */
  readonly declared_at: string;
  /**
   * Qui a déclaré le fait, quand la base le sait.
   *
   * Facultatif : la colonne est nullable, et un fait enregistré avant qu'elle
   * existe n'a pas d'auteur connu. Absent plutôt que vide, pour ne pas
   * confondre « personne ne l'a signé » avec « signé par la chaîne vide ».
   */
  readonly declared_by?: string;
  readonly forbidden: readonly ForbiddenWord[];
};

/** Rend la valeur d'un fait sous la forme qu'attendent les paramètres d'anomalie. */
export function factValueText(value: FactValue): string {
  return typeof value === 'string' ? value : String(value);
}
