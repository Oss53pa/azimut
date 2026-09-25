import type { Pictogram, PictogramRegistry, Site } from './site.js';
import type { Finding } from './outcome.js';

/**
 * Le vocabulaire des fonctions de pictogramme — A5.4.
 *
 * « `function_key` : à quoi sert ce pictogramme, et non d'où il vient. C'est
 * par elle qu'un moteur demande "le pictogramme d'accessibilité" sans
 * connaître son code. Vocabulaire à espace de noms, enrichi dans le même
 * commit que son premier usage, par exemple `access.accessible`,
 * `access.hearing_loop`, `service.restroom`. Pour le registre de sécurité, la
 * désignation vient du paquet de règles et n'est jamais saisie : c'est lui qui
 * porte ces pictogrammes. Pour le registre d'orientation, elle est libre.
 * Portée d'unicité d'une fonction : le paquet de règles pour le registre de
 * sécurité, l'organisation pour le registre d'orientation. »
 *
 * **Ce que ce module résout, et pourquoi il fallait l'inventer.** INV-5
 * interdit d'écrire dans le code une valeur d'origine normative, et le code
 * d'un pictogramme normalisé en est une. Un moteur ne pouvait donc pas nommer
 * le pictogramme qu'une règle lui impose de dessiner. La désignation de
 * fonction déplace la question : le moteur nomme le besoin, `access.accessible`,
 * qui n'est la valeur d'aucune norme, et la donnée dit quel pictogramme y
 * répond. Rien de normatif n'entre dans le code, et le moteur cesse de
 * dépendre de son appelant pour une valeur qu'il ne pouvait pas vérifier.
 *
 * **Ce module ne ferme pas l'ensemble des fonctions.** Comme la table des clés
 * de fait d'A5.11, il porte celles que le dépôt emploie. Le registre
 * d'orientation les prend libres, en toutes lettres ; fermer l'ensemble
 * refuserait ce qu'A5.4 autorise. La discipline — une fonction entre dans
 * cette table au même commit que son premier usage — porte sur l'auteur du
 * commit, non sur l'exécution.
 */

/** Une ligne du vocabulaire : la fonction, le registre qui la porte, son objet. */
export type PictogramFunctionDeclaration = {
  readonly key: string;
  /**
   * Le registre dans lequel cette fonction se cherche.
   *
   * A5.4 distingue les deux : pour la sécurité, la désignation vient du paquet
   * de règles ; pour l'orientation, elle est libre. Une fonction déclarée ici
   * dit dans lequel des deux un moteur doit la demander, et une demande faite
   * dans l'autre ne trouverait pas le pictogramme que la règle vise.
   */
  readonly registry: PictogramRegistry;
  /** À quoi elle sert, en une phrase, et la règle qui l'emploie. */
  readonly purpose: string;
};

/**
 * La fonction d'accessibilité, celle que S-39 demande pour une place.
 *
 * « Place accessible : elle porte le pictogramme du registre de sécurité
 * désigné par la fonction d'accessibilité, section A5.4, jamais un symbole
 * maison. »
 */
export const ACCESSIBLE_FUNCTION_KEY = 'access.accessible';

/** Le vocabulaire d'A5.4, dans son ordre. */
export const DECLARED_PICTOGRAM_FUNCTIONS: readonly PictogramFunctionDeclaration[] = [
  {
    key: ACCESSIBLE_FUNCTION_KEY,
    registry: 'safety',
    purpose: 'La marque d’une place de stationnement accessible, règle S-39.',
  },
];

const BY_KEY = new Map(DECLARED_PICTOGRAM_FUNCTIONS.map(d => [d.key, d]));

/**
 * La forme qu'A5.4 impose à une fonction : un espace de noms, un point, un nom.
 *
 * Même convention que les clés de fait d'A5.11, et pour le même motif : ni
 * l'un ni l'autre ne contient de point, sans quoi la coupure serait ambiguë,
 * et aucun n'est vide. La base tient la même règle, migration 0053.
 */
export function isFunctionKeyShape(key: string): boolean {
  const parts = key.split('.');
  return parts.length === 2 && parts.every(part => part !== '' && part.trim() === part);
}

/** La déclaration d'une fonction, ou `null` si le vocabulaire ne la porte pas. */
export function pictogramFunctionDeclaration(
  key: string,
): PictogramFunctionDeclaration | null {
  return BY_KEY.get(key) ?? null;
}

/**
 * Où une fonction se cherche : le registre, et pour la sécurité le paquet.
 *
 * A5.4 : « Portée d'unicité d'une fonction : le paquet de règles pour le
 * registre de sécurité, l'organisation pour le registre d'orientation. Une
 * organisation qui exploite deux sites rattachés à deux paquets différents
 * porte légitimement deux pictogrammes de même fonction, un par paquet. »
 *
 * La portée d'orientation n'a pas de paramètre : les pictogrammes qu'un moteur
 * reçoit sont ceux de l'organisation du site, tous et rien d'autre, et
 * l'organisation est donc déjà la portée. Celle de sécurité nomme son paquet,
 * sans quoi les deux pictogrammes légitimes de la règle se liraient comme une
 * ambiguïté.
 */
export type PictogramScope =
  | { readonly registry: 'wayfinding' }
  | { readonly registry: 'safety'; readonly rules_pack_id: string | null };

/**
 * La portée d'un registre pour un site donné.
 *
 * Le paquet de sécurité d'un site est celui qui lui est rattaché, A5.8. Un site
 * sans paquet n'a pas de registre de sécurité : aucune désignation n'y vient de
 * nulle part, et toute demande y rendra `not_designated`. C'est exact — la
 * marque manque, et le rendu le dira.
 */
export function siteScope(site: Site, registry: PictogramRegistry): PictogramScope {
  return registry === 'safety'
    ? { registry, rules_pack_id: site.rules_pack_id }
    : { registry };
}

function inScope(picto: Pictogram, scope: PictogramScope): boolean {
  if (picto.registry !== scope.registry) return false;
  if (scope.registry === 'wayfinding') return true;
  // Un site sans paquet ne voit aucun pictogramme de sécurité, pas même ceux
  // qui n'en déclarent pas : un pictogramme de sécurité sans paquet ne
  // provient de rien, et A5.4 dit que la désignation de ce registre « vient du
  // paquet de règles ».
  return scope.rules_pack_id !== null && picto.rules_pack_id === scope.rules_pack_id;
}

/**
 * Ce qu'une demande de fonction trouve dans un jeu de pictogrammes.
 *
 * Trois cas, et trois seulement : un pictogramme la porte, aucun ne la porte,
 * plusieurs la portent. Les deux derniers ont chacun leur code au catalogue de
 * D2.2, et ce sont deux anomalies différentes — l'une est une désignation qui
 * manque, l'autre une désignation qui se contredit.
 */
export type PictogramFunctionResolution =
  | { readonly kind: 'designated'; readonly pictogram: Pictogram }
  | { readonly kind: 'not_designated' }
  | { readonly kind: 'ambiguous'; readonly ids: readonly string[] };

/**
 * Le pictogramme qui porte une fonction dans une portée, s'il est unique.
 *
 * **L'ambiguïté n'est pas départagée.** Deux pictogrammes de la même portée qui
 * portent la même fonction sont une contradiction de la donnée, que l'unicité
 * tenue en base empêche d'écrire mais qu'un jeu assemblé hors du chemin
 * d'écriture peut porter. En choisir un serait décider à la place de celui qui
 * a désigné, et A7 tranche : « un moteur qui reçoit une entrée qu'il ne peut
 * pas traiter refuse. »
 *
 * Deux pictogrammes de même fonction dans deux portées différentes ne sont pas
 * une ambiguïté : c'est le cas qu'A5.4 nomme comme légitime, et un seul des
 * deux est dans la portée demandée.
 *
 * Un pictogramme dont le tracé est vide ne porte pas la fonction : il ne
 * dessine rien, et le retenir reviendrait à omettre la marque en silence là où
 * `PICTO.FUNCTION_NOT_DESIGNATED` doit le signaler.
 */
export function resolvePictogramFunction(
  pictograms: readonly Pictogram[],
  scope: PictogramScope,
  functionKey: string,
): PictogramFunctionResolution {
  const carrying = pictograms
    .filter(picto => inScope(picto, scope)
      && picto.function_key === functionKey
      && picto.svg_path.trim() !== '')
    .sort((a, b) => a.id.localeCompare(b.id));

  const only = carrying.length === 1 ? carrying[0] : undefined;
  if (only !== undefined) return { kind: 'designated', pictogram: only };
  if (carrying.length === 0) return { kind: 'not_designated' };
  return { kind: 'ambiguous', ids: carrying.map(picto => picto.id) };
}

/**
 * Ce qu'une résolution oppose au moteur qui l'a demandée, ou `null`.
 *
 * `PICTO.FUNCTION_NOT_DESIGNATED`, avertissement : « aucun pictogramme ne porte
 * la fonction demandée. Le rendu omet la marque et le signale, il n'en dessine
 * jamais une autre. » Le rendu continue, amputé de la marque et le disant.
 *
 * `PICTO.FUNCTION_AMBIGUOUS`, bloquant : « deux pictogrammes d'un même
 * registre portent la même fonction sur un site. » Le rendu s'arrête.
 *
 * L'entité désignée est la fonction elle-même, et non un pictogramme : dans le
 * premier cas il n'y en a aucun à nommer, et dans le second il y en a deux.
 */
export function pictogramFunctionFinding(
  resolution: PictogramFunctionResolution,
  scope: PictogramScope,
  functionKey: string,
  ruleRef: string,
): Finding | null {
  if (resolution.kind === 'designated') return null;
  const where = scopeParams(scope, functionKey);
  if (resolution.kind === 'not_designated') {
    return {
      code: 'PICTO.FUNCTION_NOT_DESIGNATED',
      severity: 'warning',
      entity: { kind: 'pictogram_function', id: functionKey },
      params: where,
      ruleRef,
    };
  }
  return {
    code: 'PICTO.FUNCTION_AMBIGUOUS',
    severity: 'blocking',
    entity: { kind: 'pictogram_function', id: functionKey },
    params: { ...where, pictogram_ids: resolution.ids.join(',') },
    ruleRef,
  };
}

/** La fonction et sa portée, telles qu'un message d'anomalie les nomme. */
function scopeParams(
  scope: PictogramScope,
  functionKey: string,
): Record<string, string> {
  const base = { function_key: functionKey, registry: scope.registry };
  return scope.registry === 'safety' && scope.rules_pack_id !== null
    ? { ...base, rules_pack_id: scope.rules_pack_id }
    : base;
}
