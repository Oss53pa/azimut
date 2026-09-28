import type { SiteRulesBinding } from '@azimut/core-model';
import type { SiteRulesBindingRow } from './row-types.js';

/**
 * A5.8 — les lignes de rattachement d'un site, passées au modèle.
 *
 * Un rôle hors des deux valeurs n'entre pas au modèle : le CHECK de la
 * migration 0065 l'exclut en base, et le lire comme un socle déciderait d'une
 * précédence que personne n'a déclarée.
 *
 * Partagé par l'assemblage d'un site et par la liste des sites du studio, pour
 * que les deux lisent le rattachement de la même façon (invariant 1).
 */
export function mapRulesBindingRows(
  rows: readonly Pick<SiteRulesBindingRow, 'id' | 'rules_pack_id' | 'role'>[],
): SiteRulesBinding[] {
  return rows
    .filter(b => b.role === 'base' || b.role === 'overlay')
    .map(b => ({
      id: b.id,
      rules_pack_id: b.rules_pack_id,
      role: b.role === 'overlay' ? 'overlay' : 'base',
    }));
}
