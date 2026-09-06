import { describe, it, expect } from 'vitest';
import {
  meterToPixel,
  pixelToMeter,
  clampScale,
  applyZoomStep,
  quantizePosition,
  quantizePoint,
  quantizeAngle,
  viewTransformSvg,
  MIN_SCALE_PX_PER_M,
  MAX_SCALE_PX_PER_M,
  ZOOM_STEP_FACTOR,
  POSITION_STEP_M,
  ANGLE_STEP_DEG,
} from '../view-transform.js';
import type { ViewState, ViewportSize } from '../view-transform.js';

const viewport: ViewportSize = { width_px: 800, height_px: 600 };

const centered: ViewState = {
  centerX_m: 0,
  centerY_m: 0,
  scale_px_per_m: 100,
  rotationDeg: 0,
};

describe('E3 — view-transform', () => {
  describe('meterToPixel / pixelToMeter round-trip', () => {
    it('origin maps to viewport center', () => {
      const px = meterToPixel({ x_m: 0, y_m: 0 }, centered, viewport);
      expect(px.x).toBe(400);
      expect(px.y).toBe(300);
    });

    it('positive X goes right on screen', () => {
      const px = meterToPixel({ x_m: 1, y_m: 0 }, centered, viewport);
      expect(px.x).toBe(500);
      expect(px.y).toBe(300);
    });

    it('positive Y (north) goes up on screen', () => {
      const px = meterToPixel({ x_m: 0, y_m: 1 }, centered, viewport);
      expect(px.x).toBe(400);
      expect(px.y).toBe(200);
    });

    it('round-trip: pixel → meter → pixel is identity', () => {
      const original = { x: 123.456, y: 234.567 };
      const m = pixelToMeter(original, centered, viewport);
      const back = meterToPixel(m, centered, viewport);
      expect(back.x).toBeCloseTo(original.x, 2);
      expect(back.y).toBeCloseTo(original.y, 2);
    });

    it('round-trip: meter → pixel → meter is identity', () => {
      const original = { x_m: 3.141, y_m: -2.718 };
      const px = meterToPixel(original, centered, viewport);
      const back = pixelToMeter(px, centered, viewport);
      expect(back.x_m).toBeCloseTo(original.x_m, 2);
      expect(back.y_m).toBeCloseTo(original.y_m, 2);
    });
  });

  describe('non-zero center', () => {
    const offset: ViewState = {
      centerX_m: 10,
      centerY_m: 20,
      scale_px_per_m: 50,
      rotationDeg: 0,
    };

    it('center point maps to viewport center', () => {
      const px = meterToPixel({ x_m: 10, y_m: 20 }, offset, viewport);
      expect(px.x).toBe(400);
      expect(px.y).toBe(300);
    });

    it('round-trip with offset center', () => {
      const m = pixelToMeter({ x: 600, y: 100 }, offset, viewport);
      const px = meterToPixel(m, offset, viewport);
      expect(px.x).toBeCloseTo(600, 2);
      expect(px.y).toBeCloseTo(100, 2);
    });
  });

  describe('rotation (E3.2)', () => {
    const rotated: ViewState = {
      centerX_m: 0,
      centerY_m: 0,
      scale_px_per_m: 100,
      rotationDeg: 90,
    };

    it('90° rotation swaps axes', () => {
      const px = meterToPixel({ x_m: 1, y_m: 0 }, rotated, viewport);
      // 90° CW rotation: (1,0) → rx=0, ry=1 → pixel (400, 200)
      expect(px.x).toBeCloseTo(400, 0);
      expect(px.y).toBeCloseTo(200, 0);
    });

    it('round-trip with rotation', () => {
      const m = pixelToMeter({ x: 500, y: 200 }, rotated, viewport);
      const px = meterToPixel(m, rotated, viewport);
      expect(px.x).toBeCloseTo(500, 2);
      expect(px.y).toBeCloseTo(200, 2);
    });
  });

  describe('clampScale (E3.3)', () => {
    it('clamps below minimum', () => {
      expect(clampScale(0.01)).toBe(MIN_SCALE_PX_PER_M);
    });

    it('clamps above maximum', () => {
      expect(clampScale(1000)).toBe(MAX_SCALE_PX_PER_M);
    });

    it('passes through values in range', () => {
      expect(clampScale(100)).toBe(100);
    });

    it('passes through boundary values', () => {
      expect(clampScale(MIN_SCALE_PX_PER_M)).toBe(MIN_SCALE_PX_PER_M);
      expect(clampScale(MAX_SCALE_PX_PER_M)).toBe(MAX_SCALE_PX_PER_M);
    });
  });

  describe('applyZoomStep', () => {
    it('positive step zooms in', () => {
      const result = applyZoomStep(100, 1);
      expect(result).toBeCloseTo(100 * ZOOM_STEP_FACTOR, 6);
    });

    it('negative step zooms out', () => {
      const result = applyZoomStep(100, -1);
      expect(result).toBeCloseTo(100 / ZOOM_STEP_FACTOR, 6);
    });

    it('clamps at maximum', () => {
      expect(applyZoomStep(MAX_SCALE_PX_PER_M, 10)).toBe(MAX_SCALE_PX_PER_M);
    });

    it('clamps at minimum', () => {
      expect(applyZoomStep(MIN_SCALE_PX_PER_M, -10)).toBe(MIN_SCALE_PX_PER_M);
    });

    it('zero steps returns same scale', () => {
      expect(applyZoomStep(42, 0)).toBe(42);
    });
  });

  describe('quantizePosition (E4.2)', () => {
    it('rounds to nearest millimeter', () => {
      expect(quantizePosition(1.2345)).toBe(1.235);
    });

    it('passes exact millimeter values', () => {
      expect(quantizePosition(5.0)).toBe(5.0);
    });

    it('step is constant at 0.001 m', () => {
      expect(POSITION_STEP_M).toBe(0.001);
    });

    it('handles negative values', () => {
      expect(quantizePosition(-3.4567)).toBeCloseTo(-3.457, 3);
    });

    it('zero stays zero', () => {
      expect(quantizePosition(0)).toBe(0);
    });
  });

  describe('quantizePoint', () => {
    it('quantizes both coordinates', () => {
      const p = quantizePoint({ x_m: 1.23456, y_m: -7.89012 });
      expect(p.x_m).toBeCloseTo(1.235, 3);
      expect(p.y_m).toBeCloseTo(-7.890, 3);
    });
  });

  describe('quantizeAngle (E4.3)', () => {
    it('rounds to nearest 0.01 degree', () => {
      expect(quantizeAngle(45.123)).toBeCloseTo(45.12, 2);
    });

    it('normalizes into [0, 360)', () => {
      expect(quantizeAngle(-10)).toBeCloseTo(350, 2);
    });

    it('normalizes 360 to 0', () => {
      expect(quantizeAngle(360)).toBe(0);
    });

    it('step is constant at 0.01 degree', () => {
      expect(ANGLE_STEP_DEG).toBe(0.01);
    });

    it('handles large angles', () => {
      const result = quantizeAngle(720.456);
      expect(result).toBeCloseTo(0.46, 2);
    });
  });

  describe('viewTransformSvg', () => {
    it('produces translate and scale', () => {
      const svg = viewTransformSvg(centered, viewport);
      expect(svg).toContain('translate(');
      expect(svg).toContain('scale(');
      expect(svg).not.toContain('rotate(');
    });

    it('includes rotate when rotationDeg ≠ 0', () => {
      const rotated: ViewState = { ...centered, rotationDeg: 45 };
      const svg = viewTransformSvg(rotated, viewport);
      expect(svg).toContain('rotate(');
    });
  });

  describe('INV-4 determinism (E4.4)', () => {
    it('same view state produces same pixel coordinates', () => {
      const p = { x_m: 12.345, y_m: -67.890 };
      const v: ViewState = {
        centerX_m: 5,
        centerY_m: -10,
        scale_px_per_m: 73.5,
        rotationDeg: 37,
      };
      const r1 = meterToPixel(p, v, viewport);
      const r2 = meterToPixel(p, v, viewport);
      expect(r1.x).toBe(r2.x);
      expect(r1.y).toBe(r2.y);
    });

    it('replayed operations yield identical quantized state', () => {
      const ops: Array<{ x_m: number; y_m: number }> = [
        { x_m: 1.23456789, y_m: 9.87654321 },
        { x_m: -0.00049, y_m: 100.9999 },
        { x_m: 0.0005, y_m: -0.0005 },
      ];
      const run = (): Array<{ x_m: number; y_m: number }> =>
        ops.map((p) => quantizePoint(p));
      const r1 = run();
      const r2 = run();
      expect(r1).toStrictEqual(r2);
    });

    it('replayed angle operations yield identical results', () => {
      const angles = [0.001, 45.005, 89.999, 180.123, 359.999, -0.004];
      const run = (): number[] => angles.map((a) => quantizeAngle(a));
      expect(run()).toStrictEqual(run());
    });

    it('viewTransformSvg is deterministic', () => {
      const v: ViewState = {
        centerX_m: 3.14159,
        centerY_m: 2.71828,
        scale_px_per_m: 42.5,
        rotationDeg: 15,
      };
      expect(viewTransformSvg(v, viewport)).toBe(viewTransformSvg(v, viewport));
    });
  });
});
