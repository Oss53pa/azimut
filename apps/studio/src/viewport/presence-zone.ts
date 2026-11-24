/**
 * S6.7c — la zone de travail d'un poste : le rectangle que sa vue montre, en
 * mètres du repère du niveau (décision Q13). Pur.
 *
 * Arrondie au centimètre : un glissement imperceptible ne fait pas repartir
 * une annonce, et la valeur publiée reste stable d'un rendu à l'autre.
 */
import type { WorkZone } from '../state/presence.js';
import type { ViewState, Viewport } from './view-transform.js';

const round = (value: number): number => Math.round(value * 100) / 100;

export function zoneOfView(view: ViewState, viewport: Viewport): WorkZone | null {
  const scale = view.scale_px_per_m;
  if (!Number.isFinite(scale) || scale <= 0) return null;
  const w = viewport.width_px / scale;
  const h = viewport.height_px / scale;
  const zone = {
    x: round(view.centerX_m - w / 2),
    y: round(view.centerY_m - h / 2),
    w: round(w),
    h: round(h),
  };
  // La base refuse une zone hors bornes (0081) : mieux vaut n'en rien dire.
  const inside = Math.abs(zone.x) <= 1_000_000 && Math.abs(zone.y) <= 1_000_000
    && zone.w > 0 && zone.w <= 1_000_000 && zone.h > 0 && zone.h <= 1_000_000;
  return inside ? zone : null;
}
