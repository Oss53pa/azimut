import type { Finding } from './outcome.js';
import { codePointCompare } from './empreinte.js';

/**
 * Calques thématiques et coloration de travail — sections S2.3 et S3.
 *
 * Deux mécanismes que la partie S ajoute à l'atelier, et qu'on tient ici
 * ensemble parce qu'ils répondent au même besoin — voir et organiser son
 * travail — sans jamais toucher ce qui se publie.
 *
 * **Ce que ce module n'est pas.** Le calque thématique n'est pas la couche
 * d'habillage d'E9.3. `decoration_layer` porte des objets dessinés, propres à
 * un niveau, et sert à composer un plan. `view_layer` ne porte rien : il dit
 * seulement ce qui s'affiche, par site, pour des objets qui appartiennent
 * ailleurs. La règle S-12 est explicite : « Un calque ne change pas la
 * propriété des données. Il ne fait qu'organiser l'affichage : une empreinte
 * appartient au module 01 qu'elle soit affichée ou non. » Les deux portent les
 * mêmes deux booléens de visibilité, et c'est la seule chose qu'ils partagent.
 */

/**
 * S-10 — les dix calques thématiques, énuméré fermé.
 *
 * L'ordre est celui de la section S9, qui est aussi celui de la phrase de S-10,
 * du fond vers le dessus : « plan de fond, empreintes, circulation et parcours,
 * signalétique, publicité, mobilier et habillage, pictogrammes, annotations,
 * esquisse, cotations ». Il ne vaut pas rang de superposition — `z_order` s'en
 * charge, et il se règle — mais il fixe l'ordre de lecture et celui des
 * anomalies, ce qu'A9 exige.
 */
export const VIEW_LAYER_KEYS = [
  'base_plan',
  'footprints',
  'circulation',
  'signage',
  'advertising',
  'furnishing',
  'pictograms',
  'annotations',
  'sketch',
  'dimensions',
] as const;

export type ViewLayerKey = (typeof VIEW_LAYER_KEYS)[number];

/**
 * Restreint une chaîne venue de l'extérieur — base, import — à un calque
 * connu. À employer à toute frontière qui reçoit du texte libre.
 */
export function isViewLayerKey(value: string): value is ViewLayerKey {
  return (VIEW_LAYER_KEYS as readonly string[]).includes(value);
}

/**
 * S-11 — le calque d'esquisse, nommé parce qu'une règle le distingue.
 *
 * « Un calque d'esquisse visible à l'écran ne s'imprime jamais, section E9. »
 * C'est le seul des dix dont les deux visibilités ne sont pas libres.
 */
export const SKETCH_LAYER_KEY = 'sketch';

/**
 * Un calque thématique — section S9, table `view_layer`.
 *
 * `visible` et `print_visible` sont **deux réglages distincts**, et non un
 * réglage et son héritage. S-11 le dit, et c'est ce qui rend la règle de
 * l'esquisse exprimable : un calque peut être à l'écran sans être à
 * l'impression. Les confondre rendrait l'esquisse ou invisible au concepteur,
 * ou présente dans le livrable ; ni l'un ni l'autre n'est acceptable.
 */
export type ViewLayer = {
  readonly id: string;
  readonly org_id: string;
  readonly site_id: string;
  readonly key: ViewLayerKey;
  readonly name: string;
  readonly visible: boolean;
  readonly print_visible: boolean;
  readonly z_order: number;
};

/**
 * Les calques dans l'ordre où ils se superposent.
 *
 * `z_order` d'abord, puis la clé, parce que deux calques de même rang
 * existeraient sans que rien ne l'interdise et qu'un ordre de rendu qui
 * dépendrait alors de l'ordre d'arrivée des lignes casserait INV-4.
 */
export function stackedLayers(layers: readonly ViewLayer[]): readonly ViewLayer[] {
  return [...layers].sort((l, r) => {
    const byOrder = l.z_order - r.z_order;
    if (byOrder !== 0) return byOrder;
    return codePointCompare(l.key, r.key);
  });
}

/** Les clés affichées à l'écran, dans l'ordre de superposition. */
export function screenLayerKeys(layers: readonly ViewLayer[]): readonly ViewLayerKey[] {
  return stackedLayers(layers).filter(l => l.visible).map(l => l.key);
}

/**
 * Les clés portées à l'impression, dans l'ordre de superposition.
 *
 * Indépendante de la précédente, et pas un sous-ensemble : un calque de
 * repérage peut n'exister qu'à l'impression. Seule l'esquisse est contrainte,
 * et par `auditViewLayers`, non ici — une fonction de lecture ne corrige pas
 * en silence ce qu'un contrôle doit refuser.
 */
export function printLayerKeys(layers: readonly ViewLayer[]): readonly ViewLayerKey[] {
  return stackedLayers(layers).filter(l => l.print_visible).map(l => l.key);
}

/**
 * S-11 — refuse une esquisse qui s'imprimerait.
 *
 * Le code est celui que D2.2 porte déjà : `SKETCH.IN_DELIVERABLE`, bloquant,
 * « Couche d'esquisse présente dans un export destiné à un tiers ». Un plan
 * imprimé est un export destiné à un tiers, donc c'est la même faute, et il
 * n'y avait pas de code nouveau à inscrire.
 *
 * Bloquant, et non corrigé au vol : un calque d'esquisse dont la case
 * d'impression est cochée dit que quelqu'un l'a cochée. Le remettre à `false`
 * en silence laisserait la case cochée à l'écran suivant.
 */
export function auditViewLayers(layers: readonly ViewLayer[]): readonly Finding[] {
  const findings: Finding[] = [];
  for (const layer of stackedLayers(layers)) {
    if (layer.key !== SKETCH_LAYER_KEY) continue;
    if (!layer.print_visible) continue;
    findings.push({
      code: 'SKETCH.IN_DELIVERABLE',
      severity: 'blocking',
      entity: { kind: 'view_layer', id: layer.id },
      params: { layer_key: layer.key },
      ruleRef: 'S-11',
    });
  }
  return findings;
}

/**
 * S-8 — ce qu'une coloration de travail peut viser.
 *
 * Trois natures, et ce sont celles que la règle nomme : « Un concepteur peut
 * colorer librement des empreintes, des zones ou des calques pour son propre
 * travail. » Rien d'autre n'est visable, et la liste ne s'élargit pas sans que
 * la section le dise.
 */
export const WORK_COLOUR_TARGET_KINDS = ['footprint', 'zone', 'view_layer'] as const;

export type WorkColourTargetKind = (typeof WORK_COLOUR_TARGET_KINDS)[number];

export function isWorkColourTargetKind(value: string): value is WorkColourTargetKind {
  return (WORK_COLOUR_TARGET_KINDS as readonly string[]).includes(value);
}

/**
 * Une coloration de travail — section S9, table `work_color`.
 *
 * `user_id` n'est pas une colonne d'audit, c'est la clé du cloisonnement :
 * S-8 dit que la coloration « est propre à l'utilisateur, n'est jamais
 * partagée ». Toute lecture passe donc par `workColoursOf`, qui l'exige.
 *
 * `hex` est une donnée, et non une couleur écrite dans le code : elle vient de
 * la base, elle est propre à un utilisateur, et elle ne décrit aucun rendu
 * publiable. L'interdiction d'A2.4 — aucune couleur en dur hors du fichier de
 * jetons — porte sur les couleurs du produit, pas sur celles qu'un concepteur
 * se donne pour lui-même.
 *
 * **Sa forme est celle des jetons de la partie F**, et la version 17 la fixe :
 * « même notation que les jetons de la partie F, six chiffres hexadécimaux
 * précédés d'un croisillon, en majuscules ». La version 16 n'en disait rien, et
 * ce module transportait alors `hex` sans le lire, faute de règle à opposer.
 */
export type WorkColour = {
  readonly id: string;
  readonly org_id: string;
  readonly site_id: string;
  readonly user_id: string;
  readonly target_kind: WorkColourTargetKind;
  readonly target_id: string;
  readonly hex: string;
};

/**
 * La notation de S9 : croisillon, six chiffres hexadécimaux, majuscules.
 *
 * La casse compte, et c'est la section qui le veut. Admettre les minuscules
 * ferait coexister deux écritures de la même couleur, donc deux valeurs
 * distinctes pour un même objet coloré, et une comparaison de colorations
 * cesserait d'être fiable. La forme à trois chiffres est refusée pour la même
 * raison : elle désigne une couleur que la forme longue désigne aussi.
 */
const WORK_COLOUR_FORM = /^#[0-9A-F]{6}$/;

/**
 * Vrai pour une valeur que `work_color.hex` peut porter, section S9.
 *
 * À une frontière, comme les prédicats de nature : une chaîne venue de la base
 * n'est pas une couleur parce que la colonne s'appelle `hex`.
 */
export function isWorkColourHex(value: string): boolean {
  return WORK_COLOUR_FORM.test(value);
}

/**
 * Les colorations d'un utilisateur, et de lui seul.
 *
 * La signature est la règle S-8 : sans identifiant d'utilisateur, on ne peut
 * pas lire une coloration. Une fonction qui rendrait « les colorations du
 * site » existerait et finirait par être appelée par un rendu ; celle-ci ne
 * peut pas l'être par accident, parce qu'un moteur de rendu n'a pas
 * d'utilisateur à lui donner.
 *
 * Rend une table indexée par `<nature>:<identifiant>`, dans l'ordre des clés,
 * pour qu'une double coloration du même objet se résolve de la même façon à
 * chaque lecture (A9). La dernière déclarée l'emporte, par identifiant.
 */
export function workColoursOf(
  colours: readonly WorkColour[],
  userId: string,
): ReadonlyMap<string, string> {
  const mine = colours
    .filter(c => c.user_id === userId)
    .sort((l, r) => codePointCompare(l.id, r.id));
  const resolved = new Map<string, string>();
  for (const colour of mine) {
    resolved.set(`${colour.target_kind}:${colour.target_id}`, colour.hex);
  }
  return new Map([...resolved.entries()].sort(([l], [r]) => codePointCompare(l, r)));
}

/**
 * S-9 — ce que l'interface doit dire en permanence.
 *
 * « L'interface indique en permanence qu'une coloration de travail est active,
 * et permet de la retirer d'un geste. Sans cela, un concepteur jugerait un plan
 * sur des couleurs qui n'existent pas. »
 *
 * La fonction rend le compte plutôt qu'un booléen : un indicateur qui dit
 * seulement « active » n'apprend rien à qui a coloré trois empreintes il y a
 * une semaine et l'a oublié.
 */
export function activeWorkColourCount(
  colours: readonly WorkColour[],
  userId: string,
): number {
  return workColoursOf(colours, userId).size;
}
