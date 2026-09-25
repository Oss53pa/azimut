/** Deux initiales tirées du nom, celles que la pastille affiche. */
export function siteInitials(name: string): string {
  const words = name.trim().split(/[\s\-–—]+/u).filter(w => w !== '');
  const letters = words.slice(0, 2).map(w => [...w][0] ?? '');
  return letters.join('').toLocaleUpperCase();
}
