/**
 * O11 — les lignes de `temporary_closure`, lues pour le modèle.
 *
 * La base garantit une plage ordonnée et au moins une arête (migration 0069).
 * Une ligne que le modèle ne sait pas lire n'est donc pas une donnée à
 * écarter en silence : c'est une incohérence, et la lecture s'arrête — une
 * fermeture perdue ouvrirait sans le dire une circulation fermée.
 */
import { localInstantOf, sortClosures, type TemporaryClosure } from '@azimut/core-model';
import type { TemporaryClosureRow } from './row-types.js';
import { asStringArray } from './row-scalars.js';

export function mapClosureRows(rows: readonly TemporaryClosureRow[]): readonly TemporaryClosure[] {
  return sortClosures(rows.map((row): TemporaryClosure => {
    const edgeIds = asStringArray(row.edge_ids) ?? [];
    const from = localInstantOf(row.from_at);
    const to = localInstantOf(row.to_at);
    if (edgeIds.length === 0 || from === null || to === null) {
      throw new Error(`temporary_closure ${row.id} illisible : arêtes ou bornes hors de la forme attendue`);
    }
    return {
      id: row.id, org_id: row.org_id, site_id: row.site_id,
      edge_ids: edgeIds, from_at: from, to_at: to, reason: row.reason,
    };
  }));
}
