/**
 * Règles de charte — A5.8, table `charter_rule`.
 *
 * « Aucune valeur de charte n'est écrite dans le code : caractères interdits,
 * limite de phrase, largeurs et tailles minimales viennent tous de ces tables.
 * Quand la charte ne porte pas une règle, le contrôle correspondant ne
 * s'exécute pas et le signale, comme pour un paquet de règles absent. Il
 * n'applique aucune valeur par défaut : une règle absente n'est pas une règle
 * permissive. »
 *
 * Ce module porte les deux natures que le dépôt sait opposer, et rien de plus.
 * Les six autres natures d'A5.8 existent dans l'énumération, sans forme de
 * paramètres déclarée : les inventer maintenant écrirait dans le code une
 * charte que personne n'a rédigée.
 *
 * **Ce n'est pas INV-5.** Aucune norme ne décide qu'un tiret cadratin est
 * interdit ni qu'une phrase s'arrête à vingt-cinq mots ; ces valeurs ne sont
 * pas d'origine normative et aucun paquet de règles n'a à les porter. C'est
 * A5.8 qui les range parmi les règles de charte, et c'est de la charte du site
 * qu'elles viennent désormais.
 */

/** Les huit natures de la table, telles qu'A5.8 les énumère. */
export type CharterRuleKind =
  | 'adjacency_forbidden'
  | 'min_logo_width'
  | 'background_allowed'
  | 'proportion'
  | 'signature_usage'
  | 'forbidden_character'
  | 'max_sentence_words';

export const CHARTER_RULE_KINDS: readonly CharterRuleKind[] = [
  'adjacency_forbidden',
  'background_allowed',
  'forbidden_character',
  'max_sentence_words',
  'min_logo_width',
  'proportion',
  'signature_usage',
];

/**
 * Un intervalle de points de code interdit par la charte.
 *
 * Le nom est celui que la charte emploie, et l'anomalie le rapporte tel quel :
 * dire « point médian » à un rédacteur est utile, dire `U+00B7` ne l'est pas.
 * Les deux bornes sont incluses, et égales pour un caractère seul.
 */
export type ForbiddenCharacterRange = {
  readonly from: number;
  readonly to: number;
  readonly name: string;
};

export type CharterRule =
  | {
    readonly kind: 'forbidden_character';
    readonly params: { readonly characters: readonly ForbiddenCharacterRange[] };
  }
  | {
    readonly kind: 'max_sentence_words';
    readonly params: { readonly maximum: number };
  }
  | {
    readonly kind: Exclude<CharterRuleKind, 'forbidden_character' | 'max_sentence_words'>;
    readonly params: Readonly<Record<string, unknown>>;
  };

/**
 * Les caractères que la charte interdit, ou `null` si elle n'en déclare aucun.
 *
 * `null` et le tableau vide ne disent pas la même chose, et c'est tout l'objet
 * de la distinction : `null` veut dire « la charte ne porte pas cette règle »,
 * donc le contrôle ne s'exécute pas ; un tableau vide veut dire « la charte
 * porte la règle et n'interdit rien », donc le contrôle s'exécute et ne trouve
 * rien. Confondre les deux ferait passer un site sans charte pour un site dont
 * la charte n'interdit rien.
 *
 * Plusieurs règles de même nature se réunissent : une charte peut interdire les
 * tirets dans une règle et les flèches dans une autre, et refuser l'une des
 * deux au motif qu'il y en a deux serait arbitraire. L'ordre rendu est celui
 * des bornes, pour que deux chargements du même jeu donnent la même liste (A9).
 */
export function resolveForbiddenCharacters(
  rules: readonly CharterRule[],
): readonly ForbiddenCharacterRange[] | null {
  const declared = rules.filter((rule) => rule.kind === 'forbidden_character');
  if (declared.length === 0) return null;
  const ranges: ForbiddenCharacterRange[] = [];
  for (const rule of declared) {
    if (rule.kind !== 'forbidden_character') continue;
    ranges.push(...rule.params.characters);
  }
  return ranges.sort((left, right) => left.from - right.from
    || left.to - right.to
    || left.name.localeCompare(right.name));
}

/**
 * La limite de phrase de la charte, ou `null` si elle ne la porte pas.
 *
 * Deux règles concurrentes : la plus contraignante gagne, comme une surcouche
 * pays durcit un socle en D3.6. Retenir la plus permissive laisserait passer ce
 * que la charte interdit ailleurs, et refuser le jeu entier ferait tomber un
 * contrôle que la charte demande bien.
 *
 * Une limite nulle ou négative n'est pas une limite : elle refuserait toute
 * phrase, y compris celles d'un mot. Elle est écartée, et si elle était la
 * seule déclarée le contrôle ne s'exécute pas — la charte porte alors une règle
 * illisible, ce qui n'est pas une règle.
 */
export function resolveMaxSentenceWords(rules: readonly CharterRule[]): number | null {
  let limit: number | null = null;
  for (const rule of rules) {
    if (rule.kind !== 'max_sentence_words') continue;
    const maximum = rule.params.maximum;
    if (!Number.isInteger(maximum) || maximum < 1) continue;
    limit = limit === null ? maximum : Math.min(limit, maximum);
  }
  return limit;
}
