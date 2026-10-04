import { describe, it, expect } from 'vitest';
import { ZOOM_STEP_FACTOR } from '@azimut/core-model';
import {
  SCALE_MAX_PX_PER_M, SCALE_MIN_PX_PER_M, panBy, toMetres, toView, zoomAround,
} from '../view-transform.js';

const viewport = { width_px: 800, height_px: 600 };
const view = { centerX_m: 10, centerY_m: 5, scale_px_per_m: 20, rotationDeg: 0 };

describe('E3.3 — zoom et déplacement de vue', () => {
  it('un cran de zoom applique le facteur nommé, et garde sous le pointeur le point qui y était', () => {
    const pivot = { x_px: 610, y_px: 140 };
    const before = toMetres(pivot, view, viewport);
    const zoomed = zoomAround(view, viewport, pivot, 1);
    expect(zoomed.scale_px_per_m).toBeCloseTo(20 * ZOOM_STEP_FACTOR, 9);
    const after = toMetres(pivot, zoomed, viewport);
    expect(after.x_m).toBeCloseTo(before.x_m, 9);
    expect(after.y_m).toBeCloseTo(before.y_m, 9);
  });

  it('un zoom avant puis arrière revient à la vue de départ', () => {
    const pivot = { x_px: 100, y_px: 500 };
    const back = zoomAround(zoomAround(view, viewport, pivot, 3), viewport, pivot, -3);
    expect(back.scale_px_per_m).toBeCloseTo(view.scale_px_per_m, 9);
    expect(back.centerX_m).toBeCloseTo(view.centerX_m, 9);
    expect(back.centerY_m).toBeCloseTo(view.centerY_m, 9);
  });

  it('hors des bornes, la vue ne bouge pas au lieu de dégénérer', () => {
    const top = { ...view, scale_px_per_m: SCALE_MAX_PX_PER_M };
    expect(zoomAround(top, viewport, { x_px: 1, y_px: 1 }, 1)).toBe(top);
    const bottom = { ...view, scale_px_per_m: SCALE_MIN_PX_PER_M };
    expect(zoomAround(bottom, viewport, { x_px: 1, y_px: 1 }, -1)).toBe(bottom);
  });

  it('un déplacement emporte le contenu avec le pointeur, l’axe vertical inversé', () => {
    const point = { x_m: 12, y_m: 7 };
    const before = toView(point, view, viewport);
    const moved = panBy(view, 30, -40);
    const after = toView(point, moved, viewport);
    expect(after.x_px).toBeCloseTo(before.x_px + 30, 9);
    expect(after.y_px).toBeCloseTo(before.y_px - 40, 9);
    expect(moved.scale_px_per_m).toBe(view.scale_px_per_m);
  });
});
