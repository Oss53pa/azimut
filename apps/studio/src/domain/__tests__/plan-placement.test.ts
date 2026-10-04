import { describe, it, expect } from 'vitest';
import { imageToWorld, isDisplayableImage, levelPlan } from '../plan-placement.js';
import { affineToView, toView } from '../../viewport/view-transform.js';
import type { PlanPlacement } from '../plan-placement.js';

const placement = (north_azimuth_deg: number): PlanPlacement => ({
  anchor_px: { x_px: 100, y_px: 200 }, scale_m_per_px: 0.05, north_azimuth_deg,
});

function close(a: number, b: number): boolean { return Math.abs(a - b) < 1e-9; }

describe('J1.4 — le plan calé dans le repère du site', () => {
  it('le point A du calage est l’origine du site', () => {
    const origin = imageToWorld({ x_px: 100, y_px: 200 }, placement(0));
    expect(close(origin.x_m, 0) && close(origin.y_m, 0)).toBe(true);
  });

  it('nord en haut de l’image : la droite est l’est, le haut est le nord', () => {
    const east = imageToWorld({ x_px: 120, y_px: 200 }, placement(0));
    const north = imageToWorld({ x_px: 100, y_px: 180 }, placement(0));
    expect(close(east.x_m, 1) && close(east.y_m, 0)).toBe(true);
    expect(close(north.x_m, 0) && close(north.y_m, 1)).toBe(true);
  });

  it('nord à droite de l’image (azimut 90) : la droite de l’image devient le nord', () => {
    const p = imageToWorld({ x_px: 120, y_px: 200 }, placement(90));
    expect(close(p.x_m, 0) && close(p.y_m, 1)).toBe(true);
  });

  it('la matrice SVG, tirée de la transformation unique, pose chaque pixel là où la vue pose son point', () => {
    const view = { centerX_m: 3, centerY_m: -2, scale_px_per_m: 25, rotationDeg: 0 };
    const viewport = { width_px: 800, height_px: 600 };
    for (const azimuth of [0, 37, 90, 211]) {
      const local = (p: { readonly x: number; readonly y: number }) =>
        imageToWorld({ x_px: p.x, y_px: p.y }, placement(azimuth));
      const m = /matrix\(([^)]+)\)/.exec(affineToView(local, view, viewport))?.[1]
        ?.split(',').map(Number) ?? [];
      const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = m;
      for (const px of [{ x_px: 0, y_px: 0 }, { x_px: 640, y_px: 480 }, { x_px: 100, y_px: 200 }]) {
        const screen = toView(imageToWorld(px, placement(azimuth)), view, viewport);
        expect(Math.abs(a * px.x_px + c * px.y_px + e - screen.x_px)).toBeLessThan(0.01);
        expect(Math.abs(b * px.x_px + d * px.y_px + f - screen.y_px)).toBeLessThan(0.01);
      }
    }
  });

  it('lit le dernier calage du niveau et son point A, depuis les lignes de la session', () => {
    const rows = [
      { table: 'plan_source', id: 'src', values: { level_id: 'niv', media_type: 'image/png' } },
      { table: 'plan_calibration', id: 'cal-1', values: { plan_source_id: 'src', scale_m_per_px: '0.1', rotation_deg: '0' } },
      { table: 'plan_calibration', id: 'cal-2', values: { plan_source_id: 'src', scale_m_per_px: '0.02', rotation_deg: '15' } },
      { table: 'plan_calibration_point', id: 'p0', values: { calibration_id: 'cal-2', ordinal: 0, image_x_px: '12', image_y_px: '34' } },
      { table: 'plan_calibration_point', id: 'p1', values: { calibration_id: 'cal-2', ordinal: 1, image_x_px: '500', image_y_px: '34' } },
    ];
    expect(levelPlan(rows, 'niv')).toEqual({
      planSourceId: 'src',
      mediaType: 'image/png',
      placement: { anchor_px: { x_px: 12, y_px: 34 }, scale_m_per_px: 0.02, north_azimuth_deg: 15 },
    });
    expect(levelPlan(rows, 'autre')).toBeNull();
  });

  it('un niveau dont le calage n’a pas de point A n’est pas calé', () => {
    const rows = [
      { table: 'plan_source', id: 'src', values: { level_id: 'niv', media_type: 'image/png' } },
      { table: 'plan_calibration', id: 'cal', values: { plan_source_id: 'src', scale_m_per_px: '0.1', rotation_deg: '0' } },
    ];
    expect(levelPlan(rows, 'niv')).toBeNull();
  });

  it('pose les images en fond, pas les PDF ni les DXF', () => {
    expect(isDisplayableImage('image/png')).toBe(true);
    expect(isDisplayableImage('image/jpeg')).toBe(true);
    expect(isDisplayableImage('application/pdf')).toBe(false);
    expect(isDisplayableImage('image/vnd.dxf')).toBe(false);
  });
});
