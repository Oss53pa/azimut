import { describe, it, expect } from 'vitest';
import {
  isToolAvailable,
  guardToolForPointer,
  type EditorTool,
} from '../pointer-tools.js';

const drawTool: EditorTool = { id: 'freehand', requires_free_draw: true };
const selectTool: EditorTool = { id: 'select', requires_free_draw: false };

describe('G3.1 — pointer tool availability', () => {
  it('mouse and stylus can use every tool', () => {
    expect(isToolAvailable(drawTool, 'mouse')).toBe(true);
    expect(isToolAvailable(drawTool, 'stylus')).toBe(true);
  });

  it('a finger cannot use a free-drawing tool', () => {
    expect(isToolAvailable(drawTool, 'finger')).toBe(false);
  });

  it('a finger can still use non-drawing tools', () => {
    expect(isToolAvailable(selectTool, 'finger')).toBe(true);
  });

  it('guardToolForPointer passes a usable combination', () => {
    expect(guardToolForPointer(drawTool, 'stylus').ok).toBe(true);
    expect(guardToolForPointer(selectTool, 'finger').ok).toBe(true);
  });

  it('guardToolForPointer flags a free-draw tool on a finger, with reason', () => {
    const r = guardToolForPointer(drawTool, 'finger');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings[0]?.code).toBe('EDIT.TOUCH_TOOL_UNAVAILABLE');
    expect(r.findings[0]?.severity).toBe('info');
    expect(r.findings[0]?.ruleRef).toBe('G3.1');
    expect(r.findings[0]?.params['pointer']).toBe('finger');
    expect(r.findings[0]?.entity).toEqual({ kind: 'tool', id: 'freehand' });
  });
});
