import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit/sites';
import type { DecorationShape } from '../scene-objects.js';
import { DEFAULT_DECORATION_STYLE } from '../scene-objects.js';
import { levelBounds, levelInitialView } from '../level-view.js';

const LEVEL = refMultilevel.levels[0]?.id ?? '';

function decoration(x: number, y: number): DecorationShape {
  return {
    id: `dec-${String(x)}`,
    orgId: 'org-1',
    layerId: 'layer-0',
    kind: 'area',
    geometry: { type: 'rectangle', origin: { x_m: x, y_m: y }, width_m: 1, height_m: 1 },
    styleRole: null,
    style: DEFAULT_DECORATION_STYLE,
    label: '',
    rotation_deg: 0,
  };
}

describe('E3.2 — framing a level', () => {
  describe('levelBounds', () => {
    it('covers the business content of the level', () => {
      const bounds = levelBounds(refMultilevel, LEVEL, []);
      expect(bounds).not.toBeNull();
      if (bounds === null) return;
      expect(bounds.maxX_m).toBeGreaterThan(bounds.minX_m);
      expect(bounds.maxY_m).toBeGreaterThan(bounds.minY_m);
    });

    it('extends to include habillage shapes (E9)', () => {
      const plain = levelBounds(refMultilevel, LEVEL, []);
      const withFar = levelBounds(refMultilevel, LEVEL, [decoration(10_000, 10_000)]);
      if (plain === null || withFar === null) throw new Error('bounds expected');
      expect(withFar.maxX_m).toBeGreaterThan(plain.maxX_m);
    });

    it('returns null for a level with nothing on it', () => {
      expect(levelBounds(refMultilevel, 'level-absent', [])).toBeNull();
    });

    it('is built only from content of the level', () => {
      const bounds = levelBounds(refMultilevel, LEVEL, []);
      if (bounds === null) throw new Error('bounds expected');

      // Recomputed here from the level-filtered content alone: if the
      // function let another level leak in, the two would differ.
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const consider = (x: number, y: number): void => {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      };
      for (const fp of refMultilevel.footprints) {
        if (fp.level_id !== LEVEL) continue;
        for (const v of fp.geometry.vertices) consider(v.x_m, v.y_m);
      }
      for (const node of refMultilevel.graph.nodes) {
        if (node.level_id !== LEVEL) continue;
        consider(node.position.x_m, node.position.y_m);
      }

      expect(bounds).toEqual({
        minX_m: minX, minY_m: minY, maxX_m: maxX, maxY_m: maxY,
      });
    });

    it('counts nodes, not only footprints', () => {
      const node = refMultilevel.graph.nodes.find(n => n.level_id === LEVEL);
      if (node === undefined) throw new Error('node expected');
      const bounds = levelBounds(refMultilevel, LEVEL, []);
      if (bounds === null) throw new Error('bounds expected');
      expect(node.position.x_m).toBeGreaterThanOrEqual(bounds.minX_m);
      expect(node.position.x_m).toBeLessThanOrEqual(bounds.maxX_m);
    });
  });

  describe('levelInitialView', () => {
    it('centres on the content', () => {
      const view = levelInitialView(refMultilevel, LEVEL, []);
      const bounds = levelBounds(refMultilevel, LEVEL, []);
      if (view === undefined || bounds === null) throw new Error('view expected');
      expect(view.centerX_m).toBeCloseTo((bounds.minX_m + bounds.maxX_m) / 2, 9);
      expect(view.centerY_m).toBeCloseTo((bounds.minY_m + bounds.maxY_m) / 2, 9);
    });

    it('opens unrotated', () => {
      expect(levelInitialView(refMultilevel, LEVEL, [])?.rotationDeg).toBe(0);
    });

    it('keeps the scale within the allowed range', () => {
      const view = levelInitialView(refMultilevel, LEVEL, []);
      if (view === undefined) throw new Error('view expected');
      expect(view.scale_px_per_m).toBeGreaterThanOrEqual(0.05);
      expect(view.scale_px_per_m).toBeLessThanOrEqual(500);
    });

    it('does not divide by zero on a single-point level', () => {
      const view = levelInitialView(refMultilevel, 'level-absent', [decoration(3, 3)]);
      if (view === undefined) throw new Error('view expected');
      expect(Number.isFinite(view.scale_px_per_m)).toBe(true);
      expect(view.centerX_m).toBe(3.5);
    });

    it('returns undefined when there is no level selected', () => {
      expect(levelInitialView(refMultilevel, '', [])).toBeUndefined();
    });

    it('returns undefined when the level is empty', () => {
      expect(levelInitialView(refMultilevel, 'level-absent', [])).toBeUndefined();
    });

    it('is deterministic (invariant 4)', () => {
      expect(levelInitialView(refMultilevel, LEVEL, [decoration(2, 2)]))
        .toEqual(levelInitialView(refMultilevel, LEVEL, [decoration(2, 2)]));
    });
  });
});
