import type { Finding } from './outcome.js';

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
 * **Trois états, et non deux.** C'est la distinction que D2.2 tranche en
 * inscrivant `CHARTER.RULE_MALFORMED` : « une règle déclarée et cassée bloque,
 * parce qu'elle a été voulue ». Une règle absente laisse le contrôle non
 * exercé et le dit ; une règle déclarée dont les paramètres ne se lisent pas
 * est une anomalie bloquante, parce que quelqu'un a voulu cette règle et
 * qu'elle ne produit rien. Les taire reviendrait à rendre une charte
 * silencieusement permissive, ce qu'A5.8 refuse.
 *
 * **Deux natures sont lues, et deux seulement.** Les cinq autres natures
 * d'A5.8 n'ont pas de forme de paramètres déclarée, volontairement : chacune
 * sera définie quand un contrôle la consommera. Elles traversent donc ce
 * module sans être validées — rien ne les lit, rien ne peut donc dire si
 * elles sont bien formées.
 *
 * **Ce n'est pas INV-5.** Aucune norme ne décide qu'un tiret cadratin est
 * interdit ni qu'une phrase s'arrête à vingt-cinq mots ; ces valeurs ne sont
 * pas d'origine normative et aucun paquet de règles n'a à les porter. C'est
 * A5.8 qui les range parmi les règles de charte, et c'est de la charte du site
 * qu'elles viennent désormais.
 */

/** Les sept natures de la table, telles qu'A5.8 les énumère. */
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
 * Une règle de charte, telle que la base la porte.
 *
 * `params` reste du JSON non restreint, parce que c'est ce que la colonne est :
 * lui donner une forme par nature ferait croire à une garantie que la base ne
 * donne pas. Ce sont les résolveurs qui valident, et qui signalent.
 *
 * `id` est celui de la ligne. Il sert à l'anomalie : F8 exige qu'une anomalie
 * porte son entité, et « une règle de charte est mal formée » sans dire
 * laquelle n'est pas corrigeable.
 */
export type CharterRule = {
  readonly id: string;
  readonly kind: CharterRuleKind;
  readonly params: Readonly<Record<string, unknown>>;
};

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

/**
 * Ce qu'une résolution rend, et pourquoi les trois champs sont nécessaires.
 *
 * `declared` dit si la charte porte une règle de cette nature, lisible ou non.
 * C'est lui qui décide du rangement : un contrôle dont la règle est déclarée
 * mais cassée n'est pas un contrôle non exercé, c'est un contrôle qui a lu la
 * charte et l'a refusée.
 *
 * `value` dit ce que le contrôle peut opposer. Il vaut `null` quand rien de
 * lisible n'a été déclaré — et le contrôle ne juge alors aucun texte, sans pour
 * autant appliquer de valeur par défaut.
 */
export type CharterRuleResolution<T> = {
  readonly declared: boolean;
  readonly value: T | null;
  readonly findings: readonly Finding[];
};

/** Motifs de rejet, stables : la couche d'interface compose son message depuis eux. */
type MalformedReason =
  | 'characters_not_array'
  | 'character_range_invalid'
  | 'maximum_not_integer'
  | 'maximum_not_positive';

function malformed(rule: CharterRule, reason: MalformedReason): Finding {
  return {
    code: 'CHARTER.RULE_MALFORMED',
    severity: 'blocking',
    entity: { kind: 'charter_rule', id: rule.id },
    params: { rule_kind: rule.kind, reason },
    ruleRef: 'A5.8',
  };
}

function toRange(raw: unknown): ForbiddenCharacterRange | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const entry = raw as Readonly<Record<string, unknown>>;
  const from = entry['from'];
  const to = entry['to'];
  const name = entry['name'];
  if (!Number.isInteger(from) || !Number.isInteger(to)) return null;
  if (typeof name !== 'string' || name.trim() === '') return null;
  // Une borne haute sous la borne basse ne désigne aucun caractère : la règle
  // n'interdirait rien, et passerait pour appliquée.
  if ((to as number) < (from as number)) return null;
  return { from: from as number, to: to as number, name };
}

/**
 * Les caractères que la charte interdit.
 *
 * `value` à `null` et le tableau vide ne disent pas la même chose, et c'est
 * tout l'objet de la distinction : `null` veut dire « rien de lisible n'est
 * déclaré », un tableau vide veut dire « la charte porte la règle et
 * n'interdit rien ». Confondre les deux ferait passer un site sans charte pour
 * un site dont la charte n'interdit rien.
 *
 * Plusieurs règles de même nature se réunissent : une charte peut interdire les
 * tirets dans une règle et les flèches dans une autre, et refuser l'une des
 * deux au motif qu'il y en a deux serait arbitraire. Une règle cassée parmi
 * plusieurs est signalée sans faire tomber les autres : la charte reste
 * opposable pour ce qu'elle dit de lisible, et bloquante pour ce qu'elle dit
 * mal.
 *
 * L'ordre rendu est celui des bornes, et les anomalies suivent l'identifiant de
 * la règle, pour que deux chargements du même jeu donnent la même sortie (A9).
 */
export function resolveForbiddenCharacters(
  rules: readonly CharterRule[],
): CharterRuleResolution<readonly ForbiddenCharacterRange[]> {
  const declared = rules
    .filter((rule) => rule.kind === 'forbidden_character')
    .sort((left, right) => left.id.localeCompare(right.id));
  if (declared.length === 0) return { declared: false, value: null, findings: [] };

  const ranges: ForbiddenCharacterRange[] = [];
  const findings: Finding[] = [];
  let readable = 0;

  for (const rule of declared) {
    const raw = rule.params['characters'];
    if (!Array.isArray(raw)) {
      findings.push(malformed(rule, 'characters_not_array'));
      continue;
    }
    const parsed: ForbiddenCharacterRange[] = [];
    let broken = false;
    for (const entry of raw) {
      const range = toRange(entry);
      if (range === null) { broken = true; break; }
      parsed.push(range);
    }
    if (broken) {
      findings.push(malformed(rule, 'character_range_invalid'));
      continue;
    }
    readable += 1;
    ranges.push(...parsed);
  }

  ranges.sort((left, right) => left.from - right.from
    || left.to - right.to
    || left.name.localeCompare(right.name));

  return { declared: true, value: readable === 0 ? null : ranges, findings };
}

/**
 * La limite de phrase de la charte.
 *
 * Deux règles concurrentes : la plus contraignante gagne, comme une surcouche
 * pays durcit un socle en D3.6. Retenir la plus permissive laisserait passer ce
 * que la charte interdit ailleurs.
 *
 * Une limite nulle ou négative n'est pas une limite : elle refuserait toute
 * phrase, y compris celles d'un mot. Elle ne correspond donc pas à la nature de
 * la règle, et c'est exactement ce que `CHARTER.RULE_MALFORMED` nomme.
 */
export function resolveMaxSentenceWords(
  rules: readonly CharterRule[],
): CharterRuleResolution<number> {
  const declared = rules
    .filter((rule) => rule.kind === 'max_sentence_words')
    .sort((left, right) => left.id.localeCompare(right.id));
  if (declared.length === 0) return { declared: false, value: null, findings: [] };

  const findings: Finding[] = [];
  let limit: number | null = null;

  for (const rule of declared) {
    const maximum = rule.params['maximum'];
    if (!Number.isInteger(maximum)) {
      findings.push(malformed(rule, 'maximum_not_integer'));
      continue;
    }
    if ((maximum as number) < 1) {
      findings.push(malformed(rule, 'maximum_not_positive'));
      continue;
    }
    const value = maximum as number;
    limit = limit === null ? value : Math.min(limit, value);
  }

  return { declared: true, value: limit, findings };
}
