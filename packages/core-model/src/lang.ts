/**
 * N1.2 / D12.1 — langues actives d'un site.
 *
 * Deux valeurs en V1, et pas une de plus : la partie N le dit explicitement,
 * et l'énuméré est fermé pour que le jour où une troisième arrive, elle passe
 * par ce fichier et par le paquet de messages, pas par une chaîne libre posée
 * dans une ligne de base.
 *
 * Le français est le jeu de clés de référence (D12.1) ; la liste ci-dessous
 * n'ordonne pas les langues par importance, elle les énumère.
 */
export const ACTIVE_LANGS = ['fr', 'en'] as const;

export type ActiveLang = (typeof ACTIVE_LANGS)[number];

/**
 * Restreint une chaîne venue de l'extérieur — base, import, fichier — à une
 * langue admise. À employer à toute frontière qui reçoit du texte libre.
 */
export function isActiveLang(value: string): value is ActiveLang {
  return (ACTIVE_LANGS as readonly string[]).includes(value);
}

/**
 * Langues déclarées d'un site, lues depuis une valeur de base quelconque.
 *
 * Les valeurs inconnues sont écartées et l'ordre déclaré est conservé : une
 * langue citée deux fois ne l'est qu'une. Une liste vide en sort quand rien
 * n'est déclaré — ce n'est pas « le français par défaut », c'est l'absence de
 * déclaration, et elle doit rester visible.
 */
export function readActiveLangs(value: unknown): readonly ActiveLang[] {
  if (!Array.isArray(value)) return [];
  const langs: ActiveLang[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    if (!isActiveLang(item)) continue;
    if (langs.includes(item)) continue;
    langs.push(item);
  }
  return langs;
}
