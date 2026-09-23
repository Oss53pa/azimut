import { describe, it, expect } from 'vitest';
import {
  toView, toMetres, fitToContent, clampScale,
  SCALE_MIN_PX_PER_M, SCALE_MAX_PX_PER_M, FIT_MARGIN_PX,
} from '../view-transform.js';
import type { ViewState, Viewport } from '../view-transform.js';

/**
 * E3.1 — la transformation unique entre les deux repères.
 *
 * L'essai porte d'abord sur l'inversion de l'axe vertical, qui est l'erreur
 * de signe la plus fréquente et la moins visible : D1.1 met Y vers le nord
 * dans le repère métier et vers le bas dans le repère d'affichage.
 */
const VIEWPORT: Viewport = { width_px: 800, height_px: 600 };
const VIEW: ViewState = {
  centerX_m: 0, centerY_m: 0, scale_px_per_m: 10, rotationDeg: 0,
};

describe('E3.1 — repère métier et repère de vue', () => {
  it('place l’origine au centre de la fenêtre', () => {
    expect(toView({ x_m: 0, y_m: 0 }, VIEW, VIEWPORT)).toEqual({ x_px: 400, y_px: 300 });
  });

  it('inverse l’axe vertical, et lui seul', () => {
    // Un point au nord est plus haut à l'écran, donc à une ordonnée moindre.
    expect(toView({ x_m: 0, y_m: 10 }, VIEW, VIEWPORT)).toEqual({ x_px: 400, y_px: 200 });
    // Un point à l'est est plus à droite, sans inversion.
    expect(toView({ x_m: 10, y_m: 0 }, VIEW, VIEWPORT)).toEqual({ x_px: 500, y_px: 300 });
  });

  it('rend le point de départ dans les deux sens', () => {
    const metric = { x_m: 12.5, y_m: -7.25 };
    expect(toMetres(toView(metric, VIEW, VIEWPORT), VIEW, VIEWPORT)).toEqual(metric);
  });

  it('borne l’échelle plutôt que de dégénérer', () => {
    expect(clampScale(0)).toBe(SCALE_MIN_PX_PER_M);
    expect(clampScale(Number.NaN)).toBe(SCALE_MIN_PX_PER_M);
    expect(clampScale(10_000)).toBe(SCALE_MAX_PX_PER_M);
    expect(clampScale(-3)).toBe(SCALE_MIN_PX_PER_M);
  });
});

describe('E3 — l’ajustement au contenu', () => {
  const SQUARE = [
    { x_m: 0, y_m: 0 }, { x_m: 20, y_m: 0 },
    { x_m: 20, y_m: 10 }, { x_m: 0, y_m: 10 },
  ];

  it('centre sur le contenu', () => {
    const view = fitToContent(SQUARE, VIEWPORT);
    expect(view.centerX_m).toBe(10);
    expect(view.centerY_m).toBe(5);
  });

  it('fait tenir le contenu dans la fenêtre, marge comprise', () => {
    const view = fitToContent(SQUARE, VIEWPORT);
    for (const point of SQUARE) {
      const seen = toView(point, view, VIEWPORT);
      expect(seen.x_px).toBeGreaterThanOrEqual(FIT_MARGIN_PX - 0.001);
      expect(seen.x_px).toBeLessThanOrEqual(VIEWPORT.width_px - FIT_MARGIN_PX + 0.001);
      expect(seen.y_px).toBeGreaterThanOrEqual(FIT_MARGIN_PX - 0.001);
      expect(seen.y_px).toBeLessThanOrEqual(VIEWPORT.height_px - FIT_MARGIN_PX + 0.001);
    }
  });

  /**
   * Diviser par une étendue nulle produirait une vue infinie, c'est-à-dire un
   * écran blanc que rien n'explique.
   */
  it('ne diverge pas sur un point unique', () => {
    const view = fitToContent([{ x_m: 3, y_m: 4 }], VIEWPORT);
    expect(view.centerX_m).toBe(3);
    expect(view.centerY_m).toBe(4);
    expect(view.scale_px_per_m).toBe(SCALE_MAX_PX_PER_M);
  });

  it('ne diverge pas sur un contenu aligné', () => {
    const view = fitToContent([{ x_m: 0, y_m: 0 }, { x_m: 100, y_m: 0 }], VIEWPORT);
    expect(Number.isFinite(view.scale_px_per_m)).toBe(true);
    expect(view.scale_px_per_m).toBeLessThanOrEqual(SCALE_MAX_PX_PER_M);
  });

  it('rend une vue utilisable sur un contenu vide', () => {
    const view = fitToContent([], VIEWPORT);
    expect(view.scale_px_per_m).toBeGreaterThan(0);
  });
});
