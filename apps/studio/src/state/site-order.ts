import { codePointCompare } from '@azimut/core-model';

/**
 * A9 — les sites dans l'ordre où un lecteur les cherche : par nom, dans la
 * langue active, déclarée par l'appelant.
 *
 * Le dépôt rend ses sites dans un ordre de donnée, par points de code : il ne
 * connaît pas la langue de l'écran. C'est donc l'écran qui ordonne pour
 * l'affichage, au moment où il sait dans quelle langue il affiche. À nom égal,
 * l'identifiant départage, par points de code.
 */
export function sitesByName<T extends { readonly id: string; readonly name: string }>(
  sites: readonly T[],
  lang: string,
): readonly T[] {
  return [...sites].sort((a, b) => a.name.localeCompare(b.name, lang) || codePointCompare(a.id, b.id));
}
