/**
 * Jeu de démonstration du module 09, servi par le dépôt de référence.
 *
 * Données synthétiques : aucun coût réel, aucun fabricant réel. Il tient la
 * place des tables de 0043 quand aucune base n'est configurée, et l'écran le
 * dit. Les montants sont en unité mineure avec leur devise (H8).
 */
import type { BudgetRegistry } from '@azimut/core-model';

export const REFERENCE_BUDGET: BudgetRegistry = {
  cost_references: [
    { id: 'cr-01', typology_key: 'bandeau_porte', substrate_key: 'vinyle', manufacturer_name: 'Sérigraphie Valmont', unit_cost: { minor: 4_800, currency: 'EUR' }, since: '2026-04-01' },
    { id: 'cr-02', typology_key: 'drapeau_suspendu', substrate_key: 'dibond', manufacturer_name: 'Sérigraphie Valmont', unit_cost: { minor: 38_500, currency: 'EUR' }, since: '2026-04-01' },
    { id: 'cr-03', typology_key: 'plan_mural', substrate_key: 'verre_serigraphie', manufacturer_name: null, unit_cost: null, since: null },
    { id: 'cr-04', typology_key: 'totem_directionnel', substrate_key: 'alu_laque', manufacturer_name: 'Métalier Sud', unit_cost: { minor: 124_000, currency: 'EUR' }, since: '2026-01-01' },
  ],
  budget_lines: [
    {
      id: 'bl-01', phase_key: 'budget.phase.interior', lot_id: 'lot-01',
      estimated: { minor: 18_420_000, currency: 'EUR' },
      quoted: { minor: 19_140_000, currency: 'EUR' },
      actual: { minor: 18_806_000, currency: 'EUR' },
    },
    {
      id: 'bl-02', phase_key: 'budget.phase.parking', lot_id: 'lot-02',
      estimated: { minor: 6_280_000, currency: 'EUR' },
      quoted: { minor: 5_990_000, currency: 'EUR' },
      actual: { minor: 5_990_000, currency: 'EUR' },
    },
    {
      id: 'bl-03', phase_key: 'budget.phase.wall_plans', lot_id: 'lot-03',
      estimated: null,
      quoted: { minor: 3_450_000, currency: 'EUR' },
      actual: null,
    },
    {
      id: 'bl-04', phase_key: 'budget.phase.cell_turnover', lot_id: null,
      estimated: { minor: 740_000, currency: 'EUR' },
      quoted: null,
      actual: null,
    },
  ],
};
