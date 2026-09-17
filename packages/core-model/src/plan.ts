/**
 * A5.2 — fond de plan et calage.
 *
 * Un niveau peut porter un ou plusieurs fonds de plan importés
 * (`plan_source`) ; chacun est calé au plus une fois (`plan_calibration`).
 * Le calage est ce qui rend un fond exploitable : sans lui, une position lue
 * sur l'image ne se convertit en mètres par aucun moyen, et toute empreinte
 * relevée dessus est fausse sans que rien ne le signale. D'où la règle N1.4 :
 * un niveau sans plan calé est une anomalie bloquante.
 *
 * S2 tient toujours : aucune coordonnée en pixels n'est stockée ailleurs
 * qu'ici. Le calage est la frontière, et il est la seule chose du modèle qui
 * parle en pixels.
 */

/** Fond de plan importé pour un niveau. Un fichier, pas une géométrie. */
export type PlanSource = {
  readonly id: string;
  readonly org_id: string;
  readonly level_id: string;
  readonly storage_path: string;
  readonly media_type: string;
  /** Horodatage ISO 8601 de l'import. */
  readonly uploaded_at: string;
};

/**
 * Calage d'un fond de plan : ce qui transforme un pixel en mètre.
 *
 * `scale_m_per_px` est l'échelle du fond, en mètres réels par pixel — l'inverse
 * de la résolution manipulée à la saisie (M2, `resolution_px_per_m`). Les deux
 * représentent la même mesure ; A5.2 fixe celle qui est stockée.
 */
export type PlanCalibration = {
  readonly id: string;
  readonly org_id: string;
  readonly plan_source_id: string;
  readonly scale_m_per_px: number;
  readonly origin_x: number;
  readonly origin_y: number;
  readonly rotation_deg: number;
};

/**
 * Vrai quand l'échelle stockée permet réellement une conversion.
 *
 * Ce n'est pas un seuil : zéro, un nombre négatif et `NaN` ne sont pas des
 * échelles trop petites, ce sont des absences d'échelle. Une ligne de calage
 * qui en porte une ne cale rien, et la laisser passer pour un calage ferait
 * taire le contrôle N1.4 au lieu de le déclencher.
 */
export function isUsableScale(scale_m_per_px: number): boolean {
  return Number.isFinite(scale_m_per_px) && scale_m_per_px > 0;
}

/**
 * Identifiants des niveaux effectivement calés : ceux qui portent au moins un
 * fond de plan lui-même calé par une échelle exploitable.
 *
 * Fonction pure, sans tri ni ordre de sortie significatif — l'ordre des
 * anomalies est fixé par l'appelant, sur les niveaux et non sur cet ensemble.
 */
export function calibratedLevelIds(
  planSources: readonly PlanSource[],
  planCalibrations: readonly PlanCalibration[],
): ReadonlySet<string> {
  const calibratedSourceIds = new Set<string>();
  for (const calibration of planCalibrations) {
    if (!isUsableScale(calibration.scale_m_per_px)) continue;
    calibratedSourceIds.add(calibration.plan_source_id);
  }

  const levelIds = new Set<string>();
  for (const source of planSources) {
    if (!calibratedSourceIds.has(source.id)) continue;
    levelIds.add(source.level_id);
  }
  return levelIds;
}
