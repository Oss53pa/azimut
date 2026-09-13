import type { Finding, Outcome } from '@azimut/core-model';

/**
 * G3.1 / G3.5 — Three pointer types with assumed different capabilities. Mouse
 * and stylus can do everything; a finger does navigation, selection and
 * property editing but not free drawing — the precision a cell footprint needs
 * cannot be had from a finger, and offering an imprecise function is worse than
 * not offering it. When a coarse pointer is in use, free-drawing tools are
 * disabled with the reason shown (EDIT.TOUCH_TOOL_UNAVAILABLE, info). Adaptation
 * follows the pointer actually used, not the declared device type.
 */
export const POINTER_TYPES = ['mouse', 'stylus', 'finger'] as const;
export type PointerType = (typeof POINTER_TYPES)[number];

export type EditorTool = {
  readonly id: string;
  /** Whether the tool draws freehand and so needs a precise pointer (G3.1). */
  readonly requires_free_draw: boolean;
};

/**
 * Whether a tool is usable with the given pointer. Only free-drawing tools are
 * gated, and only for a finger; mouse and stylus can use everything (G3.1).
 */
export function isToolAvailable(tool: EditorTool, pointer: PointerType): boolean {
  if (pointer === 'finger' && tool.requires_free_draw) return false;
  return true;
}

/**
 * Guard a tool selection against the active pointer. Returns an info
 * EDIT.TOUCH_TOOL_UNAVAILABLE (with the reason) when a free-drawing tool is
 * selected with a finger, so the UI disables it and shows why; ok otherwise.
 */
export function guardToolForPointer(
  tool: EditorTool,
  pointer: PointerType,
): Outcome<null> {
  if (isToolAvailable(tool, pointer)) {
    return { ok: true, value: null, warnings: [] };
  }
  const finding: Finding = {
    code: 'EDIT.TOUCH_TOOL_UNAVAILABLE',
    severity: 'info',
    entity: { kind: 'tool', id: tool.id },
    params: { pointer, reason: 'free_draw_needs_precise_pointer' },
    ruleRef: 'G3.1',
  };
  return { ok: false, findings: [finding] };
}
