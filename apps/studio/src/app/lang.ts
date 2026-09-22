/**
 * D12.1 — la langue d'affichage des écrans de la tranche M (partie M).
 *
 * Les cinq écrans passent tous par des clés, mais rien ne montait de
 * fournisseur au-dessus d'eux : ils tombaient sur le contexte par défaut, en
 * français, sans moyen d'en changer. F10.3 veut que les écrans soient
 * contrôlés dans les deux langues ; ils ne l'étaient donc dans aucune des
 * deux, faute de pouvoir basculer.
 *
 * La langue se lit dans l'adresse, ce qui la rend partageable : un relecteur
 * ouvre l'écran dans sa langue par un lien, sans réglage préalable.
 */

/** D12.1 — les deux langues actives de la V1. */
export const ACTIVE_LANGS = ['fr', 'en'] as const;
export type ActiveLang = (typeof ACTIVE_LANGS)[number];

export const DEFAULT_LANG: ActiveLang = 'fr';

/** La langue demandée par l'adresse, ou le français. Jamais une autre. */
export function langFromLocation(search: string): ActiveLang {
  const asked = new URLSearchParams(search).get('lang');
  return ACTIVE_LANGS.find(l => l === asked) ?? DEFAULT_LANG;
}
