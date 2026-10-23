import type { TableColumns } from './column-spec.js';
import { INPUT_COLUMNS_01 } from './input-columns-01.js';
import { INPUT_COLUMNS_02 } from './input-columns-02.js';

/**
 * Lot 4 de l'audit (A6.3) : la forme de chaque colonne de chaque table, telle
 * que la base migrée la déclare. La déclaration est découpée en parties pour
 * tenir la taille d'un fichier ; elle se lit d'un bloc.
 */
export const INPUT_COLUMNS: Readonly<Record<string, TableColumns>> = {
  ...INPUT_COLUMNS_01,
  ...INPUT_COLUMNS_02,
};

/** Les colonnes d'une table, ou `undefined` pour une table que le catalogue ne connaît pas. */
export function tableColumns(table: string): TableColumns | undefined {
  return Object.prototype.hasOwnProperty.call(INPUT_COLUMNS, table) ? INPUT_COLUMNS[table] : undefined;
}
