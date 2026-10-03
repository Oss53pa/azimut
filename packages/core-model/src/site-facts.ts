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
  /**
   * A5.11 — l'objet sur lequel le fait porte, quand il en désigne un.
   *
   * « Renseignés, le fait porte sur cet objet, par exemple la capacité annoncée
   * d'un parking donné ; vides, il porte sur le site entier. L'unicité porte
   * sur le site, la clé et la cible : un site à deux parkings déclare deux
   * capacités. »
   *
   * Entière ou absente, jamais à moitié : une nature sans identifiant ne
   * désigne aucun objet, un identifiant sans nature ne dit pas où le chercher,
   * et les deux moitiés se liraient comme un fait de site. Le type l'exprime
   * par un seul champ facultatif portant les deux valeurs, ce qu'une paire de
   * champs facultatifs ne permettrait pas — la base le tient par
   * `site_fact_target_complete`.
   */
  readonly target?: FactTarget;
  readonly forbidden: readonly ForbiddenWord[];
};

/**
 * La cible d'un fait : une nature et un identifiant.
 *
 * `kind` n'est pas un énuméré fermé, et A5.11 n'en donne pas la liste. Le
 * document a déjà deux références polymorphes de cette forme,
 * `audit_log.entity` et `attachment.entity_kind`, ni l'une ni l'autre
 * contrainte en valeur. Les contrôles qui lisent une nature la nomment
 * eux-mêmes, depuis la section qui la leur donne — voir
 * `PARKING_FACT_TARGET_KIND`.
 */
export type FactTarget = {
  readonly kind: string;
  readonly id: string;
};

/**
 * S-35 — la nature de cible qu'un fait de capacité de parking désigne.
 *
 * « Un parking est une zone de nature `parking`. » La capacité annoncée porte
 * donc sur une zone, et c'est la section S8 qui le dit, non ce module.
 */
export const PARKING_FACT_TARGET_KIND = 'zone';

/** Rend la valeur d'un fait sous la forme qu'attendent les paramètres d'anomalie. */
export function factValueText(value: FactValue): string {
  return typeof value === 'string' ? value : String(value);
}

/**
 * Les faits d'une clé donnée qui portent sur un objet précis.
 *
 * Existe parce que la lecture d'un fait ciblé est exactement ce que la version
 * 17 vient rendre possible, et qu'elle se fait de travers si on l'écrit à
 * chaque appel : un filtre sur la seule clé rendrait aussi le fait du site
 * entier, et un parking se verrait attribuer la capacité d'un autre.
 */
export function factsFor(
  facts: readonly SiteFact[],
  key: string,
  target: FactTarget,
): readonly SiteFact[] {
  return facts.filter(fact =>
    fact.key === key
    && fact.target?.kind === target.kind
    && fact.target?.id === target.id);
}
