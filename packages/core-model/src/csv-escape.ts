/**
 * Lot 4 de l'audit (A6.3) : la cellule d'un export de tableur, échappée au
 * moment de l'écrire. Une seule définition pour tous les exports.
 *
 * Deux défauts sont fermés :
 *
 *  - une cellule qui porte le séparateur, un guillemet ou une fin de ligne
 *    casserait le fichier : elle est entourée de guillemets, guillemets
 *    intérieurs doublés ;
 *  - une cellule qui commence par `=`, `+`, `-`, `@`, une tabulation ou un
 *    retour chariot serait lue comme une formule par un tableur, qui peut
 *    alors exécuter ou exfiltrer : elle est précédée d'une apostrophe, que le
 *    tableur affiche comme une marque de texte. Un nombre simple (`-3`,
 *    `+2.5`) n'est pas une formule et reste tel quel.
 */
const FORMULA_START = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^[+-]?\d+([.,]\d+)?$/;

export function escapeCsvCell(value: string, separator = ';'): string {
  const neutral = FORMULA_START.test(value) && !PLAIN_NUMBER.test(value) ? `'${value}` : value;
  return neutral.includes(separator) || /["\n\r]/.test(neutral)
    ? `"${neutral.replace(/"/g, '""')}"`
    : neutral;
}
