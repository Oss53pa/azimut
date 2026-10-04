import type { Point } from '@azimut/core-model';

/**
 * J1.4 (partie J) — le plan calé, posé dans le repère du site.
 *
 * Le calage garde l'échelle (mètres par pixel de l'image), l'azimut du nord et
 * les points de la mesure, en pixels de l'image (M01.S2). Décision de
 * l'utilisatrice, le cahier ne fixant pas ce point : le point A du calage est
 * l'origine du repère du site. Le reste s'en déduit :
 *
 *   monde = R(azimut) · échelle · (x − Ax, −(y − Ay))
 *
 * L'image a son axe vertical vers le bas, le repère du site vers le nord : le
 * signe s'inverse ici, et c'est la seule inversion propre à l'image. Celle de
 * l'affichage reste dans la sérialisation SVG (D1).
 *
 * L'azimut suit la convention compas : la direction du nord sur l'image,
 * comptée dans le sens horaire depuis le haut de l'image. Tourner l'image de
 * cet angle dans le sens trigonométrique ramène son nord sur l'axe Y du site.
 */
export type PlanPlacement = {
  readonly anchor_px: { readonly x_px: number; readonly y_px: number };
  readonly scale_m_per_px: number;
  readonly north_azimuth_deg: number;
};

/** Un pixel de l'image, en mètres dans le repère du site. */
export function imageToWorld(px: { readonly x_px: number; readonly y_px: number }, placement: PlanPlacement): Point {
  const r = (placement.north_azimuth_deg * Math.PI) / 180;
  const vx = (px.x_px - placement.anchor_px.x_px) * placement.scale_m_per_px;
  const vy = -(px.y_px - placement.anchor_px.y_px) * placement.scale_m_per_px;
  return {
    x_m: vx * Math.cos(r) - vy * Math.sin(r),
    y_m: vx * Math.sin(r) + vy * Math.cos(r),
  };
}

type Row = { readonly table: string; readonly id: string; readonly values: Readonly<Record<string, unknown>> };

export type LevelPlan = {
  readonly planSourceId: string;
  readonly mediaType: string;
  readonly placement: PlanPlacement;
};

function numberOf(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * Le plan calé d'un niveau, lu dans les lignes de la session : la source, son
 * calage et le point A de la mesure. `null` si le niveau n'est pas calé.
 *
 * Plusieurs calages d'une même source : le dernier écrit fait foi (« Recaler »
 * en écrit un nouveau, M2 (partie M)).
 */
export function levelPlan(rows: readonly Row[], levelId: string): LevelPlan | null {
  const sources = rows.filter(r => r.table === 'plan_source' && r.values['level_id'] === levelId);
  for (let s = sources.length - 1; s >= 0; s -= 1) {
    const source = sources[s];
    if (source === undefined) continue;
    const calibrations = rows.filter(r => r.table === 'plan_calibration' && r.values['plan_source_id'] === source.id);
    const calibration = calibrations[calibrations.length - 1];
    if (calibration === undefined) continue;
    const anchor = rows.find(r => r.table === 'plan_calibration_point'
      && r.values['calibration_id'] === calibration.id && numberOf(r.values['ordinal']) === 0);
    const scale = numberOf(calibration.values['scale_m_per_px']);
    const azimuth = numberOf(calibration.values['rotation_deg']) ?? 0;
    const x = numberOf(anchor?.values['image_x_px']);
    const y = numberOf(anchor?.values['image_y_px']);
    if (scale === null || !(scale > 0) || x === null || y === null) continue;
    return {
      planSourceId: source.id,
      mediaType: String(source.values['media_type'] ?? ''),
      placement: { anchor_px: { x_px: x, y_px: y }, scale_m_per_px: scale, north_azimuth_deg: azimuth },
    };
  }
  return null;
}

/** Les formats que l'atelier sait poser en fond : les images. */
export function isDisplayableImage(mediaType: string): boolean {
  return mediaType === 'image/png' || mediaType === 'image/jpeg';
}
