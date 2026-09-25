/**
 * Jeu de démonstration du module 07, servi par le dépôt de référence.
 *
 * Données synthétiques : aucun fabricant, aucun relevé réel. Il tient la place
 * des tables de 0042 quand aucune base n'est configurée, et l'écran le dit.
 * Les identifiants de support des lots et des créneaux sont fabriqués pour
 * donner des comptes lisibles ; ils ne désignent aucun support d'un site de
 * référence.
 */
import type { WorksiteRegistry } from '@azimut/core-model';

/** `count` identifiants de support synthétiques, préfixés et triés. */
function demoSupports(prefix: string, count: number): readonly string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}-${String(i + 1).padStart(3, '0')}`);
}

export const REFERENCE_WORKSITE: WorksiteRegistry = {
  lots: [
    { id: 'lot-01', code: 'LOT-01', manufacturer_name: 'Métalier Sud', state: 'in_production', support_ids: demoSupports('S-L01', 62) },
    { id: 'lot-02', code: 'LOT-02', manufacturer_name: 'Sérigraphie Valmont', state: 'delivered', support_ids: demoSupports('S-L02', 54) },
    { id: 'lot-03', code: 'LOT-03', manufacturer_name: 'Métalier Sud', state: 'ordered', support_ids: demoSupports('S-L03', 32) },
  ],
  slots: [
    { id: 'sl-01', zone_label: 'N0 galerie sud', planned_on: '2026-09-16', night_work: true, support_ids: demoSupports('S-SL01', 18) },
    { id: 'sl-02', zone_label: 'N1 noyau B', planned_on: '2026-09-18', night_work: true, support_ids: demoSupports('S-SL02', 12) },
    { id: 'sl-03', zone_label: 'N-1 parking', planned_on: '2026-09-22', night_work: false, support_ids: demoSupports('S-SL03', 9) },
    { id: 'sl-04', zone_label: 'N2 restauration', planned_on: null, night_work: false, support_ids: demoSupports('S-SL04', 12) },
  ],
  reserves: [
    {
      id: 'rs-0028', support_id: 'S-N2-03', lot_id: 'lot-02', observation_key: 'worksite.observation.plumb',
      observed_by: 'l.marchand', observed_at: '2026-09-09T09:00:00Z', lifted_at: '2026-09-13T09:00:00Z', photo_path: null,
    },
    {
      id: 'rs-0031', support_id: 'S-N0-14', lot_id: 'lot-01', observation_key: 'worksite.observation.fixing',
      observed_by: 'a.dieng', observed_at: '2026-09-10T09:00:00Z', lifted_at: null, photo_path: null,
    },
    {
      id: 'rs-0032', support_id: 'S-N1-07', lot_id: 'lot-01', observation_key: 'worksite.observation.scratch',
      observed_by: 'a.dieng', observed_at: '2026-09-10T10:00:00Z', lifted_at: null, photo_path: null,
    },
    {
      id: 'rs-0035', support_id: 'S-N-1-02', lot_id: 'lot-02', observation_key: 'worksite.observation.lamp',
      observed_by: 'l.marchand', observed_at: '2026-09-11T09:00:00Z', lifted_at: null, photo_path: null,
    },
  ],
};
