import { describe, it, expect } from 'vitest';
import { guardToolAction, availableTools } from '../context-guard.js';
import type { ToolAction } from '../tool-state.js';

describe('E1.4 — editing context guard', () => {
  // -----------------------------------------------------------------------
  // Context 1 (site) — full editing
  // -----------------------------------------------------------------------
  describe('context 1 (site)', () => {
    it('allows all drawing tools', () => {
      const action: ToolAction = { type: 'set_tool', tool: 'rectangle' };
      const result = guardToolAction(action, 'site');
      expect(result.allowed).toBe(true);
    });

    it('allows text tool', () => {
      const result = guardToolAction({ type: 'set_tool', tool: 'text' }, 'site');
      expect(result.allowed).toBe(true);
    });

    it('allows navigation tools', () => {
      const result = guardToolAction({ type: 'set_tool', tool: 'hand' }, 'site');
      expect(result.allowed).toBe(true);
    });

    it('all 12 tools are available', () => {
      const tools = availableTools('site');
      expect(tools).toHaveLength(12);
    });
  });

  // -----------------------------------------------------------------------
  // Context 2 (template) — visual editing, produces data
  // -----------------------------------------------------------------------
  describe('context 2 (template)', () => {
    it('blocks drawing tools (templates produce data, not shapes)', () => {
      const result = guardToolAction({ type: 'set_tool', tool: 'rectangle' }, 'template');
      expect(result.allowed).toBe(false);
    });

    it('blocks text tool (template text comes from data)', () => {
      const result = guardToolAction({ type: 'set_tool', tool: 'text' }, 'template');
      expect(result.allowed).toBe(false);
    });

    it('allows selection (for moving/resizing template blocks)', () => {
      const result = guardToolAction({ type: 'set_tool', tool: 'select' }, 'template');
      expect(result.allowed).toBe(true);
    });

    it('allows navigation', () => {
      const result = guardToolAction({ type: 'set_tool', tool: 'hand' }, 'template');
      expect(result.allowed).toBe(true);
    });

    it('availableTools excludes drawing and text', () => {
      const tools = availableTools('template');
      expect(tools).toContain('hand');
      expect(tools).toContain('select');
      expect(tools).not.toContain('rectangle');
      expect(tools).not.toContain('text');
    });
  });

  // -----------------------------------------------------------------------
  // Context 3 (face) — NO editing, view/control only
  // -----------------------------------------------------------------------
  describe('context 3 (face)', () => {
    it('blocks drawing tools', () => {
      const result = guardToolAction({ type: 'set_tool', tool: 'rectangle' }, 'face');
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.finding.code).toBe('EDIT.CONTEXT_VIOLATION');
      }
    });

    it('blocks text tool', () => {
      const result = guardToolAction({ type: 'set_tool', tool: 'text' }, 'face');
      expect(result.allowed).toBe(false);
    });

    it('blocks polyline tool', () => {
      const result = guardToolAction({ type: 'set_tool', tool: 'polyline' }, 'face');
      expect(result.allowed).toBe(false);
    });

    it('allows navigation tools', () => {
      expect(guardToolAction({ type: 'set_tool', tool: 'hand' }, 'face').allowed).toBe(true);
      expect(guardToolAction({ type: 'set_tool', tool: 'zoom_tool' }, 'face').allowed).toBe(true);
    });

    it('allows selection (inspection only)', () => {
      const result = guardToolAction({ type: 'set_tool', tool: 'select' }, 'face');
      expect(result.allowed).toBe(true);
    });

    it('allows direct selection (inspection only)', () => {
      const result = guardToolAction({ type: 'set_tool', tool: 'direct_select' }, 'face');
      expect(result.allowed).toBe(true);
    });

    it('availableTools returns only view/nav/selection tools', () => {
      const tools = availableTools('face');
      expect(tools).toContain('hand');
      expect(tools).toContain('zoom_tool');
      expect(tools).toContain('select');
      expect(tools).toContain('direct_select');
      expect(tools).not.toContain('rectangle');
      expect(tools).not.toContain('polyline');
      expect(tools).not.toContain('text');
      expect(tools).not.toContain('measure');
    });
  });

  // -----------------------------------------------------------------------
  // Non-tool actions
  // -----------------------------------------------------------------------
  describe('non-tool actions', () => {
    it('polygon sides change always allowed', () => {
      const result = guardToolAction(
        { type: 'set_polygon_sides', sides: 8 }, 'face',
      );
      expect(result.allowed).toBe(true);
    });

    it('gesture events pass through', () => {
      const result = guardToolAction(
        {
          type: 'gesture',
          event: {
            type: 'pointer_down',
            data: {
              position_m: { x_m: 0, y_m: 0 },
              screenX: 400, screenY: 300,
              shiftKey: false, ctrlKey: false, altKey: false,
            },
          },
        },
        'face',
      );
      expect(result.allowed).toBe(true);
    });
  });
});
