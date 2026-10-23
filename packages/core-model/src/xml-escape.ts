/**
 * Lot 6 de l'audit de sécurité : un seul échappement XML pour tout le dépôt.
 *
 * Six copies d'une fonction `esc` vivaient dans les moteurs, et aucune
 * n'échappait l'apostrophe : une valeur placée entre apostrophes dans un
 * attribut pouvait en sortir. Ces deux fonctions les remplacent.
 *
 * Le texte d'un élément et la valeur d'un attribut s'échappent de la même
 * façon, les cinq caractères réservés de XML. Les deux noms disent l'usage :
 * un relecteur voit d'un coup d'œil qu'une valeur va dans un attribut.
 */

const RESERVED: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, c => RESERVED[c] ?? c);
}

/** Le texte d'un élément XML ou SVG. */
export function escapeXmlText(value: string): string {
  return escapeXml(value);
}

/** La valeur d'un attribut XML ou SVG, entre guillemets doubles ou simples. */
export function escapeXmlAttr(value: string): string {
  return escapeXml(value);
}
