/**
 * Jeu de démonstration des tournées du module 08, servi par le dépôt de
 * référence.
 *
 * Données synthétiques : aucun relevé réel. Il tient la place des tables de
 * 0044 quand aucune base n'est configurée, et l'écran le dit. Les agents sont
 * désignés par un identifiant de démonstration, non par une personne.
 */
import type { InspectionRegistry } from '@azimut/core-model';

export const REFERENCE_INSPECTION: InspectionRegistry = {
  rounds: [
    { id: 'ir-0142', zone_label: 'N0 galerie sud', surveyor_id: 'agent-01', surveyed_on: '2026-09-14', sync_state: 'synced' },
    { id: 'ir-0143', zone_label: 'N-1 parking', surveyor_id: 'agent-01', surveyed_on: '2026-09-15', sync_state: 'pending' },
    { id: 'ir-0144', zone_label: 'N2 restauration', surveyor_id: 'agent-02', surveyed_on: '2026-09-15', sync_state: 'pending' },
  ],
  findings: [
    { id: 'if-0611', round_id: 'ir-0143', support_id: 'S-N-1-02', nature_key: 'operations.nature.lamp_out', severity: 'blocking', photo_path: null },
    { id: 'if-0612', round_id: 'ir-0142', support_id: 'S-N0-09', nature_key: 'operations.nature.soiled', severity: 'warning', photo_path: null },
    { id: 'if-0613', round_id: 'ir-0142', support_id: 'S-N1-07', nature_key: 'operations.nature.fixing', severity: 'warning', photo_path: null },
    { id: 'if-0614', round_id: 'ir-0144', support_id: 'S-N2-03', nature_key: 'operations.nature.content_diverges', severity: 'blocking', photo_path: null },
  ],
};
