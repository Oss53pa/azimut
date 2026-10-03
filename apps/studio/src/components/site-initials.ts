/**
 * Deux initiales tirées du nom, celles que la pastille affiche.
 *
 * La capitale se prend dans la langue active, déclarée par l'appelant (A9,
 * version 30) : le nom est du texte affiché, et la machine ne choisit pas sa
 * langue.
 */
export function siteInitials(name: string, lang: string): string {
  const words = name.trim().split(/[\s\-–—]+/u).filter(w => w !== '');
  const letters = words.slice(0, 2).map(w => [...w][0] ?? '');
  return letters.join('').toLocaleUpperCase(lang);
}
