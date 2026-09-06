import { describe, it, expect } from 'vitest';
import {
  createToolReducer,
  DEFAULT_TOOL_STATE,
  TOOL_REGISTRY,
} from '../tool-state.js';
import type {
  ToolState,
  ToolAction,
  PointerData,
  GestureEvent,
  ToolId,
} from '../tool-state.js';

function ptr(x: number, y: number, mods: Partial<{ shiftKey: boolean; ctrlKey: boolean; altKey: boolean }> = {}): PointerData {
  return {
    position_m: { x_m: x, y_m: y },
    screenX: x * 100,
    screenY: y * 100,
    shiftKey: mods.shiftKey ?? false,
    ctrlKey: mods.ctrlKey ?? false,
    altKey: mods.altKey ?? false,
  };
}

function gesture(event: GestureEvent): ToolAction {
  return { type: 'gesture', event };
}

describe('E7.1 — tool state machine', () => {
  describe('default state', () => {
    it('starts with select tool in idle phase', () => {
      expect(DEFAULT_TOOL_STATE.currentTool).toBe('select');
      expect(DEFAULT_TOOL_STATE.phase).toBe('idle');
      expect(DEFAULT_TOOL_STATE.preview.kind).toBe('none');
    });
  });

  describe('set_tool', () => {
    it('switches to the chosen tool', () => {
      const reduce = createToolReducer();
      const s = reduce(DEFAULT_TOOL_STATE, { type: 'set_tool', tool: 'rectangle' });
      expect(s.currentTool).toBe('rectangle');
      expect(s.phase).toBe('idle');
    });

    it('cancels in-progress gesture when switching', () => {
      const reduce = createToolReducer();
      let s = reduce(DEFAULT_TOOL_STATE, { type: 'set_tool', tool: 'rectangle' });
      s = reduce(s, gesture({ type: 'pointer_down', data: ptr(0, 0) }));
      expect(s.phase).toBe('active');
      s = reduce(s, { type: 'set_tool', tool: 'ellipse' });
      expect(s.phase).toBe('idle');
      expect(s.preview.kind).toBe('none');
    });
  });

  describe('set_polygon_sides', () => {
    it('sets sides within range', () => {
      const reduce = createToolReducer();
      const s = reduce(DEFAULT_TOOL_STATE, { type: 'set_polygon_sides', sides: 8 });
      expect(s.polygonSides).toBe(8);
    });

    it('clamps minimum to 3', () => {
      const reduce = createToolReducer();
      const s = reduce(DEFAULT_TOOL_STATE, { type: 'set_polygon_sides', sides: 1 });
      expect(s.polygonSides).toBe(3);
    });

    it('clamps maximum to 64', () => {
      const reduce = createToolReducer();
      const s = reduce(DEFAULT_TOOL_STATE, { type: 'set_polygon_sides', sides: 100 });
      expect(s.polygonSides).toBe(64);
    });

    it('rounds non-integer sides', () => {
      const reduce = createToolReducer();
      const s = reduce(DEFAULT_TOOL_STATE, { type: 'set_polygon_sides', sides: 5.7 });
      expect(s.polygonSides).toBe(6);
    });
  });

  describe('rectangle tool', () => {
    it('full lifecycle: idle → active → done', () => {
      const reduce = createToolReducer();
      let s = reduce(DEFAULT_TOOL_STATE, { type: 'set_tool', tool: 'rectangle' });
      expect(s.phase).toBe('idle');

      s = reduce(s, gesture({ type: 'pointer_down', data: ptr(1, 1) }));
      expect(s.phase).toBe('active');

      s = reduce(s, gesture({ type: 'pointer_move', data: ptr(3, 4) }));
      expect(s.phase).toBe('active');
      expect(s.preview.kind).toBe('rect');
      if (s.preview.kind === 'rect') {
        expect(s.preview.origin).toStrictEqual({ x_m: 1, y_m: 1 });
        expect(s.preview.corner).toStrictEqual({ x_m: 3, y_m: 4 });
      }

      s = reduce(s, gesture({ type: 'pointer_up', data: ptr(3, 4) }));
      expect(s.phase).toBe('done');
    });

    it('shift constrains to square', () => {
      const reduce = createToolReducer();
      let s = reduce(DEFAULT_TOOL_STATE, { type: 'set_tool', tool: 'rectangle' });
      s = reduce(s, gesture({ type: 'pointer_down', data: ptr(0, 0) }));
      s = reduce(s, gesture({ type: 'pointer_move', data: ptr(5, 3, { shiftKey: true }) }));
      if (s.preview.kind === 'rect') {
        // Larger dimension = 5, so square side = 5
        expect(s.preview.corner.x_m).toBe(5);
        expect(s.preview.corner.y_m).toBe(5);
      }
    });

    it('cancel returns to idle', () => {
      const reduce = createToolReducer();
      let s = reduce(DEFAULT_TOOL_STATE, { type: 'set_tool', tool: 'rectangle' });
      s = reduce(s, gesture({ type: 'pointer_down', data: ptr(0, 0) }));
      s = reduce(s, gesture({ type: 'cancel' }));
      expect(s.phase).toBe('idle');
      expect(s.preview.kind).toBe('none');
    });
  });

  describe('ellipse tool', () => {
    it('builds ellipse preview', () => {
      const reduce = createToolReducer();
      let s = reduce(DEFAULT_TOOL_STATE, { type: 'set_tool', tool: 'ellipse' });
      s = reduce(s, gesture({ type: 'pointer_down', data: ptr(5, 5) }));
      s = reduce(s, gesture({ type: 'pointer_move', data: ptr(8, 7) }));
      expect(s.preview.kind).toBe('ellipse');
      if (s.preview.kind === 'ellipse') {
        expect(s.preview.center).toStrictEqual({ x_m: 5, y_m: 5 });
        expect(s.preview.rx_m).toBe(3);
        expect(s.preview.ry_m).toBe(2);
      }
    });

    it('shift constrains to circle', () => {
      const reduce = createToolReducer();
      let s = reduce(DEFAULT_TOOL_STATE, { type: 'set_tool', tool: 'ellipse' });
      s = reduce(s, gesture({ type: 'pointer_down', data: ptr(0, 0) }));
      s = reduce(s, gesture({ type: 'pointer_move', data: ptr(3, 2, { shiftKey: true }) }));
      if (s.preview.kind === 'ellipse') {
        expect(s.preview.rx_m).toBe(3);
        expect(s.preview.ry_m).toBe(3);
      }
    });
  });

  describe('regular polygon tool', () => {
    it('builds polygon preview from center to cursor', () => {
      const reduce = createToolReducer();
      let s: ToolState = { ...DEFAULT_TOOL_STATE, currentTool: 'regular_polygon', polygonSides: 5 };
      s = reduce(s, gesture({ type: 'pointer_down', data: ptr(0, 0) }));
      s = reduce(s, gesture({ type: 'pointer_move', data: ptr(3, 4) }));
      expect(s.preview.kind).toBe('polygon');
      if (s.preview.kind === 'polygon') {
        expect(s.preview.sides).toBe(5);
        expect(s.preview.radius_m).toBeCloseTo(5, 5);
      }
    });
  });

  describe('polyline tool', () => {
    it('accumulates points on each click', () => {
      const reduce = createToolReducer();
      let s = reduce(DEFAULT_TOOL_STATE, { type: 'set_tool', tool: 'polyline' });
      s = reduce(s, gesture({ type: 'pointer_down', data: ptr(0, 0) }));
      expect(s.accumulatedPoints).toHaveLength(1);
      s = reduce(s, gesture({ type: 'pointer_down', data: ptr(5, 0) }));
      expect(s.accumulatedPoints).toHaveLength(2);
      s = reduce(s, gesture({ type: 'pointer_down', data: ptr(5, 5) }));
      expect(s.accumulatedPoints).toHaveLength(3);
    });

    it('shows rubber-band preview on move', () => {
      const reduce = createToolReducer();
      let s = reduce(DEFAULT_TOOL_STATE, { type: 'set_tool', tool: 'polyline' });
      s = reduce(s, gesture({ type: 'pointer_down', data: ptr(0, 0) }));
      s = reduce(s, gesture({ type: 'pointer_move', data: ptr(3, 3) }));
      expect(s.preview.kind).toBe('polyline');
      if (s.preview.kind === 'polyline') {
        expect(s.preview.points).toHaveLength(2); // accumulated + cursor
      }
    });

    it('commit finishes the polyline', () => {
      const reduce = createToolReducer();
      let s = reduce(DEFAULT_TOOL_STATE, { type: 'set_tool', tool: 'polyline' });
      s = reduce(s, gesture({ type: 'pointer_down', data: ptr(0, 0) }));
      s = reduce(s, gesture({ type: 'pointer_down', data: ptr(5, 0) }));
      s = reduce(s, gesture({ type: 'commit' }));
      expect(s.phase).toBe('done');
    });

    it('cancel clears accumulated points', () => {
      const reduce = createToolReducer();
      let s = reduce(DEFAULT_TOOL_STATE, { type: 'set_tool', tool: 'polyline' });
      s = reduce(s, gesture({ type: 'pointer_down', data: ptr(0, 0) }));
      s = reduce(s, gesture({ type: 'cancel' }));
      expect(s.accumulatedPoints).toHaveLength(0);
      expect(s.phase).toBe('idle');
    });
  });

  describe('measure tool', () => {
    it('builds measure preview from drag', () => {
      const reduce = createToolReducer();
      let s = reduce(DEFAULT_TOOL_STATE, { type: 'set_tool', tool: 'measure' });
      s = reduce(s, gesture({ type: 'pointer_down', data: ptr(0, 0) }));
      s = reduce(s, gesture({ type: 'pointer_move', data: ptr(3, 4) }));
      expect(s.preview.kind).toBe('measure');
      if (s.preview.kind === 'measure') {
        expect(s.preview.from).toStrictEqual({ x_m: 0, y_m: 0 });
        expect(s.preview.to).toStrictEqual({ x_m: 3, y_m: 4 });
      }
    });
  });

  describe('dimension tool', () => {
    it('builds dimension preview from drag', () => {
      const reduce = createToolReducer();
      let s = reduce(DEFAULT_TOOL_STATE, { type: 'set_tool', tool: 'dimension' });
      s = reduce(s, gesture({ type: 'pointer_down', data: ptr(1, 1) }));
      s = reduce(s, gesture({ type: 'pointer_move', data: ptr(5, 1) }));
      expect(s.preview.kind).toBe('dimension');
      if (s.preview.kind === 'dimension') {
        expect(s.preview.from).toStrictEqual({ x_m: 1, y_m: 1 });
        expect(s.preview.to).toStrictEqual({ x_m: 5, y_m: 1 });
      }
    });
  });

  describe('non-drawing tools pass through', () => {
    const nonDrawingTools: ToolId[] = ['select', 'direct_select', 'hand', 'zoom_tool', 'text'];
    for (const tool of nonDrawingTools) {
      it(`${tool} ignores gesture events`, () => {
        const reduce = createToolReducer();
        let s = reduce(DEFAULT_TOOL_STATE, { type: 'set_tool', tool });
        s = reduce(s, gesture({ type: 'pointer_down', data: ptr(0, 0) }));
        expect(s.phase).toBe('idle');
        expect(s.preview.kind).toBe('none');
      });
    }
  });

  describe('TOOL_REGISTRY', () => {
    it('has an entry for every tool id', () => {
      const allIds: ToolId[] = [
        'select', 'direct_select', 'hand', 'zoom_tool',
        'rectangle', 'ellipse', 'regular_polygon',
        'polyline', 'bezier',
        'text', 'dimension', 'measure',
      ];
      for (const id of allIds) {
        expect(TOOL_REGISTRY.find(m => m.id === id)).toBeDefined();
      }
    });

    it('has no duplicate shortcut keys', () => {
      const keys = TOOL_REGISTRY
        .map(m => m.shortcutKey)
        .filter((k): k is string => k !== null);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('has no duplicate ids', () => {
      const ids = TOOL_REGISTRY.map(m => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
