import { describe, it, expect } from 'vitest';
import { previewToCommand } from '../command-integration.js';
import { historyReducer, EMPTY_HISTORY } from '../command.js';
import type { ToolPreview } from '../tool-state.js';

const TS = '2026-01-01T00:00:00Z';

describe('E5+E7 — command integration', () => {
  describe('previewToCommand', () => {
    it('converts rect preview to command with quantized points', () => {
      const preview: ToolPreview = {
        kind: 'rect',
        origin: { x_m: 0.0001, y_m: 0.0002 },
        corner: { x_m: 3.4567, y_m: 2.3456 },
      };
      const cmd = previewToCommand(preview, 'rectangle', 'shape-1', TS);
      expect(cmd).not.toBeNull();
      if (cmd === null) return;
      expect(cmd.type).toBe('shape.create.rectangle');
      expect(cmd.targetId).toBe('shape-1');
      expect(cmd.after.kind).toBe('rect');
      // Quantized to mm
      if (cmd.after.kind === 'rect') {
        expect(cmd.after.origin.x_m).toBeCloseTo(0, 3);
        expect(cmd.after.corner.x_m).toBeCloseTo(3.457, 3);
      }
    });

    it('rejects zero-area rectangle', () => {
      const preview: ToolPreview = {
        kind: 'rect',
        origin: { x_m: 1, y_m: 1 },
        corner: { x_m: 1, y_m: 3 }, // zero width
      };
      expect(previewToCommand(preview, 'rectangle', 'x', TS)).toBeNull();
    });

    it('converts ellipse preview', () => {
      const preview: ToolPreview = {
        kind: 'ellipse',
        center: { x_m: 5, y_m: 5 },
        rx_m: 2,
        ry_m: 1.5,
      };
      const cmd = previewToCommand(preview, 'ellipse', 'e1', TS);
      expect(cmd).not.toBeNull();
      if (cmd !== null) {
        expect(cmd.after.kind).toBe('ellipse');
      }
    });

    it('rejects zero-radius ellipse', () => {
      const preview: ToolPreview = {
        kind: 'ellipse',
        center: { x_m: 5, y_m: 5 },
        rx_m: 0,
        ry_m: 1.5,
      };
      expect(previewToCommand(preview, 'ellipse', 'x', TS)).toBeNull();
    });

    it('converts polygon preview', () => {
      const preview: ToolPreview = {
        kind: 'polygon',
        center: { x_m: 0, y_m: 0 },
        radius_m: 3,
        sides: 6,
        rotation_deg: 30,
      };
      const cmd = previewToCommand(preview, 'regular_polygon', 'p1', TS);
      expect(cmd).not.toBeNull();
      if (cmd !== null && cmd.after.kind === 'polygon') {
        expect(cmd.after.sides).toBe(6);
      }
    });

    it('rejects polygon with < 3 sides', () => {
      const preview: ToolPreview = {
        kind: 'polygon',
        center: { x_m: 0, y_m: 0 },
        radius_m: 3,
        sides: 2,
        rotation_deg: 0,
      };
      expect(previewToCommand(preview, 'regular_polygon', 'x', TS)).toBeNull();
    });

    it('converts polyline preview with quantized points', () => {
      const preview: ToolPreview = {
        kind: 'polyline',
        points: [
          { x_m: 0, y_m: 0 },
          { x_m: 5.1234, y_m: 0 },
          { x_m: 5.1234, y_m: 3.6789 },
        ],
      };
      const cmd = previewToCommand(preview, 'polyline', 'pl1', TS);
      expect(cmd).not.toBeNull();
      if (cmd !== null && cmd.after.kind === 'polyline') {
        expect(cmd.after.points).toHaveLength(3);
        // Quantized to mm
        expect(cmd.after.points[1]?.x_m).toBeCloseTo(5.123, 3);
      }
    });

    it('rejects polyline with < 2 points', () => {
      const preview: ToolPreview = {
        kind: 'polyline',
        points: [{ x_m: 0, y_m: 0 }],
      };
      expect(previewToCommand(preview, 'polyline', 'x', TS)).toBeNull();
    });

    it('converts measure preview', () => {
      const preview: ToolPreview = {
        kind: 'measure',
        from: { x_m: 0, y_m: 0 },
        to: { x_m: 10, y_m: 0 },
      };
      const cmd = previewToCommand(preview, 'measure', 'm1', TS);
      expect(cmd).not.toBeNull();
    });

    it('rejects zero-length measure', () => {
      const preview: ToolPreview = {
        kind: 'measure',
        from: { x_m: 5, y_m: 5 },
        to: { x_m: 5, y_m: 5 },
      };
      expect(previewToCommand(preview, 'measure', 'x', TS)).toBeNull();
    });

    it('converts dimension preview', () => {
      const preview: ToolPreview = {
        kind: 'dimension',
        from: { x_m: 0, y_m: 0 },
        to: { x_m: 8, y_m: 0 },
        offset_m: 1.5,
      };
      const cmd = previewToCommand(preview, 'dimension', 'd1', TS);
      expect(cmd).not.toBeNull();
      if (cmd !== null && cmd.after.kind === 'dimension') {
        expect(cmd.after.offset_m).toBe(1.5);
      }
    });

    it('returns null for empty preview', () => {
      const preview: ToolPreview = { kind: 'none' };
      expect(previewToCommand(preview, 'rectangle', 'x', TS)).toBeNull();
    });

    it('before value is empty/zero for creation commands', () => {
      const preview: ToolPreview = {
        kind: 'rect',
        origin: { x_m: 1, y_m: 1 },
        corner: { x_m: 5, y_m: 3 },
      };
      const cmd = previewToCommand(preview, 'rectangle', 's1', TS);
      expect(cmd).not.toBeNull();
      if (cmd !== null && cmd.before.kind === 'rect') {
        // Before is zero — undo removes the shape
        expect(cmd.before.origin.x_m).toBe(0);
        expect(cmd.before.corner.x_m).toBe(0);
      }
    });

    it('command integrates with history reducer', () => {
      const preview: ToolPreview = {
        kind: 'rect',
        origin: { x_m: 1, y_m: 1 },
        corner: { x_m: 5, y_m: 3 },
      };
      const cmd = previewToCommand(preview, 'rectangle', 's1', TS);
      expect(cmd).not.toBeNull();
      if (cmd === null) return;

      const state = historyReducer(EMPTY_HISTORY, { type: 'execute', command: cmd });
      expect(state.undoStack).toHaveLength(1);
      expect(state.redoStack).toHaveLength(0);

      // Undo
      const undone = historyReducer(state, { type: 'undo' });
      expect(undone.undoStack).toHaveLength(0);
      expect(undone.redoStack).toHaveLength(1);
    });
  });
});
