
/**
 * Nombres et dates d'affichage, à la convention de la langue active :
 * « 3 604,10 » en français, « 3,604.10 » en anglais. Rien de ce qui sort d'ici
 * n'est relu par un moteur ; c'est de l'affichage.
 */
export function formatNumber(value: number, lang: string, decimals: number): string {
  return new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Une date ISO 8601 ramenée au jour, ou `null` si elle ne se lit pas. */
export function formatDay(iso: string | undefined, lang: string): string | null {
  if (iso === undefined) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
  });
}
