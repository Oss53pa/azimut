import type { Point } from '@azimut/core-model';
import { point, structured } from '../state/row-values.js';
import type { StoredRow } from '../state/session-store.js';

/**
 * La position d'un nœud, telle que la ligne la porte.
 *
 * `null` quand elle ne se lit pas. L'appelant le dit plutôt que de poser
 * l'origine : une arête tracée depuis une position inventée serait écrite en
 * base, et rien ne la distinguerait d'une arête saisie.
 */
export function positionOf(row: StoredRow): Point | null {
  return point(structured(row.values, 'position'));
}
