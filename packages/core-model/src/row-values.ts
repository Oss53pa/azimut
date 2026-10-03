/**
 * Les valeurs d'une ligne telles qu'une commande les transporte — E5.1.
 *
 * Fichier minuscule et délibérément à part : `site-commands.ts` déclare ce
 * qu'est une commande, `command-checks.ts` dit ce qui la refuse, et les deux
 * ont besoin de la même notion de ligne et de la même différence entre deux
 * états. La poser ici évite que l'un importe une valeur de l'autre.
 */

/** Une valeur de colonne telle qu'elle voyage dans une commande. */
export type ColumnValue = string | number | boolean | null;

/** L'état d'une ligne, colonne par colonne. */
export type RowValues = Readonly<Record<string, ColumnValue>>;

/**
 * Les colonnes que le passage d'un état à l'autre touche.
 *
 * Création et suppression touchent toutes les colonnes nommées : il n'y a rien
 * à comparer, et l'union des deux jeux de clés est la réponse juste. Une
 * modification ne retient que celles dont la valeur change, ce qui rend
 * `changedColumns` utile — une commande peut nommer des colonnes qu'elle ne
 * change pas.
 */
export function touchedColumns(
  before: RowValues | null,
  after: RowValues | null,
): readonly string[] {
  if (before === null || after === null) {
    return [...new Set([
      ...Object.keys(before ?? {}), ...Object.keys(after ?? {}),
    ])].sort();
  }
  const names = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...names].filter(n => before[n] !== after[n]).sort();
}
