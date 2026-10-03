/**
 * E3.1 — la transformation entre repère métier et repère de vue.
 *
 * « Une transformation unique, exportée par un module dédié, convertit dans
 * les deux sens. Aucun composant d'interface ne calcule sa propre conversion.
 * C'est la règle la plus facile à enfreindre et la plus coûteuse à corriger
 * plus tard. »
 *
 * D1.1 fixe les deux repères : le repère métier est en mètres, X vers l'est et
 * Y vers le nord ; le repère de vue est en pixels, origine en haut à gauche et
 * axe vertical vers le bas. L'inversion de l'axe vertical se fait ici, au
 * dernier moment, et nulle part ailleurs.
 */
import type { Point } from '@azimut/core-model';

/** E3.2 — l'état de vue. */
export type ViewState = {
  readonly centerX_m: number;
  readonly centerY_m: number;
  readonly scale_px_per_m: number;
  /**
   * E3.2 : « sert exclusivement à l'aperçu d'un plan orienté selon la section
   * D6. Il ne modifie jamais les données. »
   */
  readonly rotationDeg: number;
};

/** Un point du repère de vue, en pixels. */
export type ViewPoint = { readonly x_px: number; readonly y_px: number };

/** La fenêtre d'affichage, en pixels. */
export type Viewport = { readonly width_px: number; readonly height_px: number };

/** E3.3 — l'échelle est bornée. Hors bornes, l'outil refuse au lieu de dégénérer. */
export const SCALE_MIN_PX_PER_M = 0.05;
export const SCALE_MAX_PX_PER_M = 500;

/** La marge laissée autour du contenu quand la vue s'ajuste, en pixels. */
export const FIT_MARGIN_PX = 24;

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) return SCALE_MIN_PX_PER_M;
  return Math.min(SCALE_MAX_PX_PER_M, Math.max(SCALE_MIN_PX_PER_M, scale));
}

/** Du repère métier vers le repère de vue. L'axe vertical s'inverse ici. */
export function toView(point: Point, view: ViewState, viewport: Viewport): ViewPoint {
  const dx = (point.x_m - view.centerX_m) * view.scale_px_per_m;
  const dy = (point.y_m - view.centerY_m) * view.scale_px_per_m;
  return {
    x_px: viewport.width_px / 2 + dx,
    y_px: viewport.height_px / 2 - dy,
  };
}

/** Du repère de vue vers le repère métier. */
export function toMetres(point: ViewPoint, view: ViewState, viewport: Viewport): Point {
  return {
    x_m: view.centerX_m + (point.x_px - viewport.width_px / 2) / view.scale_px_per_m,
    y_m: view.centerY_m - (point.y_px - viewport.height_px / 2) / view.scale_px_per_m,
  };
}

/**
 * La vue qui montre tout le contenu.
 *
 * Un contenu vide ou réduit à un point ne donne aucune étendue : l'échelle
 * retombe alors sur la borne haute plutôt que de diverger, et le centre sur le
 * point lui-même. Diviser par une étendue nulle produirait une vue infinie,
 * c'est-à-dire un écran blanc que rien n'explique.
 */
export function fitToContent(
  points: readonly Point[],
  viewport: Viewport,
): ViewState {
  if (points.length === 0) {
    return { centerX_m: 0, centerY_m: 0, scale_px_per_m: 1, rotationDeg: 0 };
  }

  const xs = points.map(p => p.x_m);
  const ys = points.map(p => p.y_m);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const width_m = maxX - minX;
  const height_m = maxY - minY;
  const usableWidth = Math.max(1, viewport.width_px - 2 * FIT_MARGIN_PX);
  const usableHeight = Math.max(1, viewport.height_px - 2 * FIT_MARGIN_PX);

  const scale = width_m <= 0 && height_m <= 0
    ? SCALE_MAX_PX_PER_M
    : Math.min(
      width_m > 0 ? usableWidth / width_m : SCALE_MAX_PX_PER_M,
      height_m > 0 ? usableHeight / height_m : SCALE_MAX_PX_PER_M,
    );

  return {
    centerX_m: (minX + maxX) / 2,
    centerY_m: (minY + maxY) / 2,
    scale_px_per_m: clampScale(scale),
    rotationDeg: 0,
  };
}
