import { describe, it, expect } from 'vitest';
import { viewReducer, DEFAULT_VIEW } from '../viewport-state.js';
import type { ViewAction } from '../viewport-state.js';
import type { ViewState, ViewportSize } from '@azimut/core-model';
import {
  MIN_SCALE_PX_PER_M,
  MAX_SCALE_PX_PER_M,
} from '@azimut/core-model';

const vp: ViewportSize = { width_px: 800, height_px: 600 };

describe('E3 — viewport-state reducer', () => {
  describe('pan', () => {
    it('panning right moves center left in meters', () => {
      const next = viewReducer(DEFAULT_VIEW, {
        type: 'pan', dx_px: 100, dy_px: 0,
      });
      expect(next.centerX_m).toBeLessThan(DEFAULT_VIEW.centerX_m);
    });

    it('panning down moves center up in meters (Y north)', () => {
      const next = viewReducer(DEFAULT_VIEW, {
        type: 'pan', dx_px: 0, dy_px: 100,
      });
      expect(next.centerY_m).toBeGreaterThan(DEFAULT_VIEW.centerY_m);
    });

    it('pan by zero is identity', () => {
      const next = viewReducer(DEFAULT_VIEW, {
        type: 'pan', dx_px: 0, dy_px: 0,
      });
      expect(next).toStrictEqual(DEFAULT_VIEW);
    });

    it('pan never enters undo stack — scale and rotation unchanged', () => {
      const next = viewReducer(DEFAULT_VIEW, {
        type: 'pan', dx_px: 50, dy_px: -30,
      });
      expect(next.scale_px_per_m).toBe(DEFAULT_VIEW.scale_px_per_m);
      expect(next.rotationDeg).toBe(DEFAULT_VIEW.rotationDeg);
    });
  });

  describe('zoom', () => {
    it('positive steps zoom in (increase scale)', () => {
      const next = viewReducer(DEFAULT_VIEW, {
        type: 'zoom', steps: 1, pivot: { x: 400, y: 300 }, viewport: vp,
      });
      expect(next.scale_px_per_m).toBeGreaterThan(DEFAULT_VIEW.scale_px_per_m);
    });

    it('negative steps zoom out (decrease scale)', () => {
      const next = viewReducer(DEFAULT_VIEW, {
        type: 'zoom', steps: -1, pivot: { x: 400, y: 300 }, viewport: vp,
      });
      expect(next.scale_px_per_m).toBeLessThan(DEFAULT_VIEW.scale_px_per_m);
    });

    it('zoom towards pivot keeps point under pointer', () => {
      // Zooming in at center: center should not move
      const next = viewReducer(DEFAULT_VIEW, {
        type: 'zoom', steps: 3, pivot: { x: 400, y: 300 }, viewport: vp,
      });
      expect(next.centerX_m).toBeCloseTo(DEFAULT_VIEW.centerX_m, 6);
      expect(next.centerY_m).toBeCloseTo(DEFAULT_VIEW.centerY_m, 6);
    });

    it('zoom at max scale returns same state', () => {
      const atMax: ViewState = { ...DEFAULT_VIEW, scale_px_per_m: MAX_SCALE_PX_PER_M };
      const next = viewReducer(atMax, {
        type: 'zoom', steps: 1, pivot: { x: 400, y: 300 }, viewport: vp,
      });
      expect(next).toBe(atMax); // reference equality — no change
    });

    it('zoom at min scale returns same state', () => {
      const atMin: ViewState = { ...DEFAULT_VIEW, scale_px_per_m: MIN_SCALE_PX_PER_M };
      const next = viewReducer(atMin, {
        type: 'zoom', steps: -1, pivot: { x: 400, y: 300 }, viewport: vp,
      });
      expect(next).toBe(atMin);
    });
  });

  describe('zoom_to_scale', () => {
    it('sets scale to exact value', () => {
      const next = viewReducer(DEFAULT_VIEW, {
        type: 'zoom_to_scale', scale: 200,
      });
      expect(next.scale_px_per_m).toBe(200);
    });

    it('clamps scale above max', () => {
      const next = viewReducer(DEFAULT_VIEW, {
        type: 'zoom_to_scale', scale: 9999,
      });
      expect(next.scale_px_per_m).toBe(MAX_SCALE_PX_PER_M);
    });
  });

  describe('center_on', () => {
    it('sets center coordinates', () => {
      const next = viewReducer(DEFAULT_VIEW, {
        type: 'center_on', x_m: 10, y_m: 20,
      });
      expect(next.centerX_m).toBe(10);
      expect(next.centerY_m).toBe(20);
    });

    it('preserves scale and rotation', () => {
      const next = viewReducer(DEFAULT_VIEW, {
        type: 'center_on', x_m: 10, y_m: 20,
      });
      expect(next.scale_px_per_m).toBe(DEFAULT_VIEW.scale_px_per_m);
      expect(next.rotationDeg).toBe(DEFAULT_VIEW.rotationDeg);
    });
  });

  describe('set_rotation', () => {
    it('sets rotation', () => {
      const next = viewReducer(DEFAULT_VIEW, {
        type: 'set_rotation', deg: 45,
      });
      expect(next.rotationDeg).toBe(45);
    });

    it('preserves center and scale', () => {
      const v: ViewState = { centerX_m: 5, centerY_m: 10, scale_px_per_m: 100, rotationDeg: 0 };
      const next = viewReducer(v, { type: 'set_rotation', deg: 90 });
      expect(next.centerX_m).toBe(5);
      expect(next.centerY_m).toBe(10);
      expect(next.scale_px_per_m).toBe(100);
    });
  });

  describe('fit', () => {
    it('centers on bounds midpoint', () => {
      const next = viewReducer(DEFAULT_VIEW, {
        type: 'fit',
        bounds: { minX: 10, minY: 20, maxX: 30, maxY: 40 },
        viewport: vp,
        padding_px: 0,
      });
      expect(next.centerX_m).toBe(20);
      expect(next.centerY_m).toBe(30);
    });

    it('scales to fit bounds in viewport', () => {
      const next = viewReducer(DEFAULT_VIEW, {
        type: 'fit',
        bounds: { minX: 0, minY: 0, maxX: 80, maxY: 60 },
        viewport: vp,
        padding_px: 0,
      });
      // 800/80 = 10, 600/60 = 10, min = 10
      expect(next.scale_px_per_m).toBe(10);
    });

    it('respects padding', () => {
      const next = viewReducer(DEFAULT_VIEW, {
        type: 'fit',
        bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
        viewport: vp,
        padding_px: 100,
      });
      // available: (800-200)/100=6, (600-200)/100=4, min=4
      expect(next.scale_px_per_m).toBe(4);
    });

    it('clamps scale to allowed range', () => {
      const next = viewReducer(DEFAULT_VIEW, {
        type: 'fit',
        bounds: { minX: 0, minY: 0, maxX: 0.001, maxY: 0.001 },
        viewport: vp,
        padding_px: 0,
      });
      expect(next.scale_px_per_m).toBe(MAX_SCALE_PX_PER_M);
    });

    it('degenerate bounds returns unchanged state', () => {
      const next = viewReducer(DEFAULT_VIEW, {
        type: 'fit',
        bounds: { minX: 5, minY: 5, maxX: 5, maxY: 5 },
        viewport: vp,
        padding_px: 0,
      });
      expect(next).toBe(DEFAULT_VIEW);
    });

    it('preserves rotation', () => {
      const v: ViewState = { ...DEFAULT_VIEW, rotationDeg: 30 };
      const next = viewReducer(v, {
        type: 'fit',
        bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
        viewport: vp,
        padding_px: 0,
      });
      expect(next.rotationDeg).toBe(30);
    });
  });

  describe('INV-4 determinism', () => {
    it('same actions produce same state', () => {
      const actions: ViewAction[] = [
        { type: 'pan', dx_px: 50, dy_px: -30 },
        { type: 'zoom', steps: 2, pivot: { x: 200, y: 150 }, viewport: vp },
        { type: 'center_on', x_m: 5, y_m: 10 },
        { type: 'set_rotation', deg: 45 },
      ];
      const run = (): ViewState =>
        actions.reduce<ViewState>((s, a) => viewReducer(s, a), DEFAULT_VIEW);
      expect(run()).toStrictEqual(run());
    });
  });
});
