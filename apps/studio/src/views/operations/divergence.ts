/**
 * Module 08 — la couche de divergence : le rapprochement entre ce que le
 * carnet prévoit et ce que le site porte.
 *
 * Le relevé, ce sont les supports du site avec leur azimut et leurs
 * dimensions ; l'attendu, un support par point de décision du profil.
 * Aucune plage d'orientation ni dimension minimale n'est déclarée par le
 * modèle : les bornes sont ouvertes, et le rapprochement ne rend que ce qu'il
 * peut établir — le superflu et le non couvert. Rien n'est inventé pour
 * remplir les colonnes d'orientation et de taille.
 */
import type { SiteData, TravelProfile } from '@azimut/core-model';
import { reconcile, deriveDecisionPoints } from '@azimut/engine-graph';
import type { SurveyedSupport, ExpectedSupport, ReconciliationReport } from '@azimut/engine-graph';

/**
 * Tolérance d'orientation du rapprochement, en degrés. Garde-fou de relevé,
 * pas un seuil normatif : une plage déclarée par site le remplacera.
 */
export const ORIENTATION_TOLERANCE_DEG = 5;

export function divergenceReport(site: SiteData, profile: TravelProfile): ReconciliationReport | null {
  const typeByKey = new Map(site.support_types.map(type => [type.key, type]));
  const firstType = site.support_types[0];

  const surveyed: readonly SurveyedSupport[] = [...site.supports]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((support): SurveyedSupport => {
      const type = firstType === undefined ? undefined : typeByKey.get(firstType.key);
      const face = type?.faces[0];
      return {
        id: support.id,
        node_id: support.node_id,
        azimuth_deg: support.azimuth_deg,
        width_m: (support.width_mm ?? face?.default_width_mm ?? 0) / 1000,
        height_m: (support.height_mm ?? face?.default_height_mm ?? 0) / 1000,
      };
    });

  const points = deriveDecisionPoints(site, profile, site.destinations);
  const expected: readonly ExpectedSupport[] = (points.ok ? points.value : [])
    .map((point): ExpectedSupport => ({
      node_id: point.node_id,
      min_azimuth_deg: 0,
      max_azimuth_deg: 360,
      min_width_m: 0,
      min_height_m: 0,
    }));

  const result = reconcile(site, profile, surveyed, expected, ORIENTATION_TOLERANCE_DEG);
  return result.ok ? result.value : null;
}
