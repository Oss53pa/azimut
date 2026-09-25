import type { FactValue, SiteFact, FactTarget } from './site-facts.js';

/**
 * Convention de clé des faits du site — A5.11.
 *
 * « Une clé de fait est composée d'un espace de noms et d'un nom, séparés par
 * un point, et chaque clé déclare le type attendu de sa valeur. Sans ce type,
 * un jour quelqu'un écrira "oui" là où un autre attend un booléen. »
 *
 * « Une clé nouvelle s'ajoute à cette table, avec son type et sa cible, dans le
 * même commit que son premier usage. Une valeur qui ne correspond pas au type
 * déclaré est refusée. »
 *
 * **Ce que ce module est, et ce qu'il n'est pas.** Il porte la table d'A5.11,
 * telle quelle, et la question qu'elle permet de poser : cette valeur
 * convient-elle à cette clé. Il ne ferme pas l'ensemble des clés. A5.11 refuse
 * une valeur mal typée, en toutes lettres ; elle ne refuse pas une clé
 * inconnue, et l'inventer bannirait les faits déclarés avant que la convention
 * existe, que le document n'a pas retirés. La discipline d'inscription — une
 * clé nouvelle entre dans la table au même commit que son premier usage —
 * porte sur l'auteur du commit, non sur l'exécution.
 *
 * **Où le refus s'applique.** Au passage obligé de l'écriture, `buildCommand`
 * (M12.A2). Une commande sur `site_fact` dont la valeur ne correspond pas au
 * type déclaré de sa clé est une commande mal formée, et `buildCommand` la
 * refuse comme telle.
 */

/**
 * Le type attendu d'une valeur de fait.
 *
 * Trois valeurs, parce que la table d'A5.11 en déclare trois. Le texte est
 * entré avec `parking.undigitized_reason`, la première clé qui le demandait,
 * comme la clé elle-même entre avec son premier usage : un vocabulaire de
 * types plus large que la table qu'il sert ne décrirait rien de réel.
 */
export type FactValueType = 'integer' | 'boolean' | 'text';

/** Une ligne de la table d'A5.11 : la clé, son type attendu, sa cible. */
export type FactKeyDeclaration = {
  readonly key: string;
  readonly value_type: FactValueType;
  /**
   * La nature de l'objet ciblé, au sens de `FactTarget.kind`.
   *
   * S-35 : « Une place de stationnement est une empreinte de nature
   * `parking_space`. Un parking est une zone de nature `parking`. » La cible
   * d'une capacité est donc une zone, celle d'un compte de places non
   * numérisées une empreinte.
   */
  readonly target_kind: string;
  /**
   * La nature de cet objet dans sa propre table : `parking` pour la zone,
   * `parking_space` pour l'empreinte. Deux clés peuvent viser la même table
   * sans viser les mêmes lignes, et la colonne « Cible » d'A5.11 nomme les
   * deux — « zone de nature `parking` », « empreinte de nature
   * `parking_space` ».
   */
  readonly target_object_kind: string;
};

export const PARKING_CAPACITY_KEY = 'parking.capacity';
export const PARKING_FREE_KEY = 'parking.free';
export const PARKING_UNDIGITIZED_SPACES_KEY = 'parking.undigitized_spaces';
/**
 * Le motif pour lequel une surface de parking n'est pas numérisée — S-37.
 *
 * « Une empreinte de nature `parking_space` peut être marquée non numérisée,
 * avec le nombre de places qu'elle est censée porter, le motif pour lequel
 * elle ne l'est pas, et sa source. Le nombre et le motif sont deux faits
 * ciblant cette empreinte. » Bord de page, calque absent, zone illisible :
 * ce que `parking_uncovered_area.reason` portait avant son retrait, et que
 * rien ne portait plus depuis.
 */
export const PARKING_UNDIGITIZED_REASON_KEY = 'parking.undigitized_reason';

/** La table d'A5.11, dans son ordre. */
export const DECLARED_FACT_KEYS: readonly FactKeyDeclaration[] = [
  {
    key: PARKING_CAPACITY_KEY,
    value_type: 'integer',
    target_kind: 'zone',
    target_object_kind: 'parking',
  },
  {
    key: PARKING_FREE_KEY,
    value_type: 'boolean',
    target_kind: 'zone',
    target_object_kind: 'parking',
  },
  {
    key: PARKING_UNDIGITIZED_SPACES_KEY,
    value_type: 'integer',
    target_kind: 'footprint',
    target_object_kind: 'parking_space',
  },
  {
    key: PARKING_UNDIGITIZED_REASON_KEY,
    value_type: 'text',
    target_kind: 'footprint',
    target_object_kind: 'parking_space',
  },
];

const BY_KEY = new Map(DECLARED_FACT_KEYS.map(d => [d.key, d]));

/**
 * La forme qu'A5.11 impose à une clé : un espace de noms, un point, un nom.
 *
 * Ni l'un ni l'autre ne contient de point, sans quoi la coupure serait
 * ambiguë, et aucun n'est vide.
 */
export function isFactKeyShape(key: string): boolean {
  const parts = key.split('.');
  return parts.length === 2 && parts.every(part => part !== '' && part.trim() === part);
}

/** La déclaration d'une clé, ou `null` si la table ne la porte pas. */
export function factKeyDeclaration(key: string): FactKeyDeclaration | null {
  return BY_KEY.get(key) ?? null;
}

/**
 * Une valeur convient-elle au type déclaré.
 *
 * `integer` exige un nombre entier fini : `3.5` n'est pas un compte de places,
 * et `NaN` ne se compare à rien. `boolean` exige un booléen, et rejette donc
 * « oui », ce que la convention nomme comme le cas à prévenir. `text` exige une
 * chaîne, et rejette donc un nombre écrit là où un motif est attendu. Une
 * chaîne vide reste une chaîne : A5.11 refuse une valeur mal typée, non une
 * valeur pauvre, et juger qu'un motif en est un n'est pas l'affaire du type.
 */
export function factValueMatchesType(value: FactValue, type: FactValueType): boolean {
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'text') return typeof value === 'string';
  return typeof value === 'number' && Number.isInteger(value);
}

/** Ce qu'une valeur mal typée oppose à sa déclaration, ou `null` si elle convient. */
export type FactValueFault = {
  readonly key: string;
  readonly expected: FactValueType;
  readonly received: string;
};

/**
 * Le défaut d'une valeur au regard de la table, ou `null`.
 *
 * Une clé que la table ne porte pas ne produit aucun défaut : rien ne dit ce
 * qu'elle attend, et refuser faute de déclaration refuserait tous les faits
 * antérieurs à la convention.
 */
export function factValueFault(key: string, value: FactValue): FactValueFault | null {
  const declaration = factKeyDeclaration(key);
  if (declaration === null) return null;
  if (factValueMatchesType(value, declaration.value_type)) return null;
  return { key, expected: declaration.value_type, received: typeof value };
}

/**
 * La valeur entière déclarée pour une clé sur une cible, ou `null`.
 *
 * Rend `null` quand aucun fait ne porte sur cette cible, et quand plusieurs y
 * portent : l'unicité par site, clé et cible est tenue en base, et deux faits
 * concurrents en mémoire ne se départagent pas ici. Le type est garanti par la
 * table, mais la vérification reste faite : ce module lit aussi des faits
 * assemblés hors du chemin d'écriture.
 */
export function declaredInteger(
  facts: readonly SiteFact[],
  key: string,
  target: FactTarget,
): number | null {
  const matching = facts.filter(fact =>
    fact.key === key
    && fact.target?.kind === target.kind
    && fact.target?.id === target.id);
  const only = matching.length === 1 ? matching[0] : undefined;
  if (only === undefined) return null;
  return typeof only.value === 'number' && Number.isInteger(only.value) ? only.value : null;
}
