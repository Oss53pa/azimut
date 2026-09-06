import { describe, it, expect } from 'vitest';
import {
  traceCell,
  closeCell,
  parallelOffset,
  divideCell,
  fuseCells,
  traceCirculationAxis,
  placeTypedNode,
  duplicateInSeries,
  reportLevel,
} from '../domain-tools.js';
import type { Point } from '@azimut/core-model';
import { polygonArea } from '../boolean-ops.js';

describe('E7.2 — domain-specific tools', () => {
  // -----------------------------------------------------------------------
  // Cell tracing
  // -----------------------------------------------------------------------
  describe('traceCell', () => {
    it('returns points unchanged when freeAngle=true', () => {
      const pts: Point[] = [
        { x_m: 0, y_m: 0 },
        { x_m: 3, y_m: 4 },
      ];
      expect(traceCell(pts, true)).toStrictEqual(pts);
    });

    it('inserts corner points for orthogonal constraint', () => {
      const pts: Point[] = [
        { x_m: 0, y_m: 0 },
        { x_m: 3, y_m: 4 },
      ];
      const result = traceCell(pts, false);
      // Should have: (0,0) → (3,0) → (3,4) — corner inserted
      expect(result).toHaveLength(3);
      expect(result[1]).toStrictEqual({ x_m: 3, y_m: 0 });
    });

    it('does not insert corner for axis-aligned segments', () => {
      const pts: Point[] = [
        { x_m: 0, y_m: 0 },
        { x_m: 5, y_m: 0 },
      ];
      const result = traceCell(pts, false);
      expect(result).toHaveLength(2);
    });

    it('returns input for fewer than 2 points', () => {
      expect(traceCell([{ x_m: 1, y_m: 1 }], false)).toHaveLength(1);
    });
  });

  describe('closeCell', () => {
    it('adds closing corner for orthogonal closure', () => {
      const pts: Point[] = [
        { x_m: 0, y_m: 0 },
        { x_m: 5, y_m: 0 },
        { x_m: 5, y_m: 3 },
      ];
      const result = closeCell(pts);
      // Last (5,3) to first (0,0) needs corner (0,3)
      expect(result).toHaveLength(4);
      expect(result[3]).toStrictEqual({ x_m: 0, y_m: 3 });
    });

    it('does not add corner when already aligned', () => {
      const pts: Point[] = [
        { x_m: 0, y_m: 0 },
        { x_m: 5, y_m: 0 },
        { x_m: 5, y_m: 3 },
        { x_m: 0, y_m: 3 },
      ];
      // (0,3) to (0,0) is vertical — already aligned
      expect(closeCell(pts)).toHaveLength(4);
    });

    it('does nothing for already closed polygon', () => {
      const pts: Point[] = [
        { x_m: 0, y_m: 0 },
        { x_m: 1, y_m: 0 },
        { x_m: 1, y_m: 1 },
        { x_m: 0, y_m: 0 },
      ];
      expect(closeCell(pts)).toHaveLength(4);
    });

    it('returns input for fewer than 3 points', () => {
      expect(closeCell([{ x_m: 0, y_m: 0 }])).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // Parallel offset
  // -----------------------------------------------------------------------
  describe('parallelOffset', () => {
    it('generates closed polygon from axis line', () => {
      const axis: Point[] = [
        { x_m: 0, y_m: 0 },
        { x_m: 10, y_m: 0 },
      ];
      const result = parallelOffset(axis, 0.2);
      // 2 left + 2 right = 4 vertices
      expect(result).toHaveLength(4);
    });

    it('wall polygon has correct area', () => {
      const axis: Point[] = [
        { x_m: 0, y_m: 0 },
        { x_m: 10, y_m: 0 },
      ];
      const result = parallelOffset(axis, 0.2);
      // Area = length(10) × thickness(0.2) = 2
      expect(polygonArea(result)).toBeCloseTo(2, 1);
    });

    it('returns empty for single point', () => {
      expect(parallelOffset([{ x_m: 0, y_m: 0 }], 0.2)).toStrictEqual([]);
    });

    it('returns empty for zero thickness', () => {
      const axis: Point[] = [
        { x_m: 0, y_m: 0 },
        { x_m: 5, y_m: 0 },
      ];
      expect(parallelOffset(axis, 0)).toStrictEqual([]);
    });

    it('handles multi-segment axis', () => {
      const axis: Point[] = [
        { x_m: 0, y_m: 0 },
        { x_m: 5, y_m: 0 },
        { x_m: 5, y_m: 5 },
      ];
      const result = parallelOffset(axis, 0.2);
      // 3 left + 3 right = 6 vertices
      expect(result).toHaveLength(6);
    });
  });

  // -----------------------------------------------------------------------
  // Cell division
  // -----------------------------------------------------------------------
  describe('divideCell', () => {
    it('vertical split creates two cells', () => {
      const result = divideCell(0, 0, 10, 5, 'vertical', 4);
      expect(result).not.toBeNull();
      if (result !== null) {
        expect(polygonArea(result.cellA)).toBeCloseTo(20); // 4×5
        expect(polygonArea(result.cellB)).toBeCloseTo(30); // 6×5
      }
    });

    it('horizontal split creates two cells', () => {
      const result = divideCell(0, 0, 10, 6, 'horizontal', 2);
      expect(result).not.toBeNull();
      if (result !== null) {
        expect(polygonArea(result.cellA)).toBeCloseTo(20); // 10×2
        expect(polygonArea(result.cellB)).toBeCloseTo(40); // 10×4
      }
    });

    it('returns null for split outside bounds', () => {
      expect(divideCell(0, 0, 10, 5, 'vertical', 15)).toBeNull();
      expect(divideCell(0, 0, 10, 5, 'vertical', -1)).toBeNull();
    });

    it('returns null for split on boundary', () => {
      expect(divideCell(0, 0, 10, 5, 'vertical', 0)).toBeNull();
      expect(divideCell(0, 0, 10, 5, 'vertical', 10)).toBeNull();
    });

    it('both halves sum to original area', () => {
      const result = divideCell(0, 0, 10, 5, 'vertical', 3);
      if (result !== null) {
        const totalArea = polygonArea(result.cellA) + polygonArea(result.cellB);
        expect(totalArea).toBeCloseTo(50); // 10×5
      }
    });
  });

  // -----------------------------------------------------------------------
  // Cell fusion
  // -----------------------------------------------------------------------
  describe('fuseCells', () => {
    it('fuses two adjacent cells into bounding box', () => {
      const result = fuseCells(
        { minX: 0, minY: 0, maxX: 5, maxY: 3 },
        { minX: 5, minY: 0, maxX: 10, maxY: 3 },
      );
      expect(polygonArea(result)).toBeCloseTo(30); // 10×3
    });

    it('handles overlapping cells', () => {
      const result = fuseCells(
        { minX: 0, minY: 0, maxX: 6, maxY: 4 },
        { minX: 4, minY: 0, maxX: 10, maxY: 4 },
      );
      expect(polygonArea(result)).toBeCloseTo(40); // 10×4
    });
  });

  // -----------------------------------------------------------------------
  // Circulation axis
  // -----------------------------------------------------------------------
  describe('traceCirculationAxis', () => {
    it('produces nodes and edges from polyline', () => {
      const pts: Point[] = [
        { x_m: 0, y_m: 0 },
        { x_m: 5, y_m: 0 },
        { x_m: 5, y_m: 3 },
      ];
      const result = traceCirculationAxis(pts, 'corridor', 'ax1');
      expect(result.nodes).toHaveLength(3);
      expect(result.edges).toHaveLength(2);
    });

    it('edge weight equals distance', () => {
      const pts: Point[] = [
        { x_m: 0, y_m: 0 },
        { x_m: 3, y_m: 4 },
      ];
      const result = traceCirculationAxis(pts, 'corridor', 'ax1');
      expect(result.edges[0]?.weight_m).toBeCloseTo(5);
    });

    it('nodes have the specified kind', () => {
      const pts: Point[] = [
        { x_m: 0, y_m: 0 },
        { x_m: 1, y_m: 0 },
      ];
      const result = traceCirculationAxis(pts, 'lobby', 'ax1');
      for (const n of result.nodes) {
        expect(n.kind).toBe('lobby');
      }
    });

    it('returns empty for single point', () => {
      const result = traceCirculationAxis([{ x_m: 0, y_m: 0 }], 'c', 'ax');
      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
    });

    it('node ids use prefix', () => {
      const pts: Point[] = [
        { x_m: 0, y_m: 0 },
        { x_m: 1, y_m: 0 },
      ];
      const result = traceCirculationAxis(pts, 'c', 'floor1');
      expect(result.nodes[0]?.id).toBe('floor1-n0');
      expect(result.nodes[1]?.id).toBe('floor1-n1');
    });
  });

  // -----------------------------------------------------------------------
  // Typed node placement
  // -----------------------------------------------------------------------
  describe('placeTypedNode', () => {
    it('creates node with type chosen before gesture', () => {
      const node = placeTypedNode({ x_m: 5, y_m: 3 }, 'elevator', 'node-42');
      expect(node.kind).toBe('elevator');
      expect(node.position).toStrictEqual({ x_m: 5, y_m: 3 });
      expect(node.id).toBe('node-42');
    });
  });

  // -----------------------------------------------------------------------
  // Series duplication
  // -----------------------------------------------------------------------
  describe('duplicateInSeries', () => {
    it('creates n positions along direction', () => {
      const result = duplicateInSeries(
        { x_m: 0, y_m: 0 },
        { x_m: 1, y_m: 0 },
        3,
        4,
      );
      expect(result.positions).toHaveLength(4);
      expect(result.positions[0]).toStrictEqual({ x_m: 0, y_m: 0 });
      expect(result.positions[3]?.x_m).toBeCloseTo(9);
    });

    it('works along diagonal', () => {
      const result = duplicateInSeries(
        { x_m: 0, y_m: 0 },
        { x_m: 1, y_m: 1 }, // 45°
        Math.SQRT2,
        3,
      );
      expect(result.positions).toHaveLength(3);
      expect(result.positions[1]?.x_m).toBeCloseTo(1);
      expect(result.positions[1]?.y_m).toBeCloseTo(1);
    });

    it('returns empty for count=0', () => {
      const result = duplicateInSeries(
        { x_m: 0, y_m: 0 },
        { x_m: 1, y_m: 0 },
        1, 0,
      );
      expect(result.positions).toHaveLength(0);
    });

    it('returns empty for zero spacing', () => {
      const result = duplicateInSeries(
        { x_m: 0, y_m: 0 },
        { x_m: 1, y_m: 0 },
        0, 5,
      );
      expect(result.positions).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Level report
  // -----------------------------------------------------------------------
  describe('reportLevel', () => {
    it('copies nodes with new ids and preserves positions', () => {
      const nodes = [
        { nodeId: 'src-n0', position: { x_m: 1, y_m: 2 }, kind: 'corridor' },
        { nodeId: 'src-n1', position: { x_m: 5, y_m: 2 }, kind: 'elevator' },
      ];
      const edges = [{ fromId: 'src-n0', toId: 'src-n1' }];
      const result = reportLevel(nodes, edges, 'floor2');

      expect(result.nodes).toHaveLength(2);
      expect(result.nodes[0]?.id).toBe('floor2-n0');
      expect(result.nodes[0]?.position).toStrictEqual({ x_m: 1, y_m: 2 });
    });

    it('remaps edge ids to new node ids', () => {
      const nodes = [
        { nodeId: 'src-n0', position: { x_m: 0, y_m: 0 }, kind: 'c' },
        { nodeId: 'src-n1', position: { x_m: 3, y_m: 4 }, kind: 'c' },
      ];
      const edges = [{ fromId: 'src-n0', toId: 'src-n1' }];
      const result = reportLevel(nodes, edges, 'lv2');

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0]?.fromNodeId).toBe('lv2-n0');
      expect(result.edges[0]?.toNodeId).toBe('lv2-n1');
      expect(result.edges[0]?.weight_m).toBeCloseTo(5);
    });

    it('skips edges referencing unknown nodes', () => {
      const nodes = [
        { nodeId: 'src-n0', position: { x_m: 0, y_m: 0 }, kind: 'c' },
      ];
      const edges = [{ fromId: 'src-n0', toId: 'src-missing' }];
      const result = reportLevel(nodes, edges, 'lv2');
      expect(result.edges).toHaveLength(0);
    });

    it('preserves node kinds', () => {
      const nodes = [
        { nodeId: 'n0', position: { x_m: 0, y_m: 0 }, kind: 'stairwell' },
      ];
      const result = reportLevel(nodes, [], 'lv3');
      expect(result.nodes[0]?.kind).toBe('stairwell');
    });
  });
});
