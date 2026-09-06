/**
 * E16 — Central keyboard shortcut dispatcher.
 *
 * "Single declaration table. Never scattered across components."
 *
 * This hook listens for keyboard events and dispatches to the
 * appropriate subsystem based on DEFAULT_SHORTCUTS table matching.
 * All keyboard handling converges here — individual hooks
 * (use-undo-redo, use-clipboard) provide action callbacks,
 * and this hook calls them when matched.
 *
 * Tool shortcuts, edit commands, view commands, and selection
 * commands are all handled from one place.
 */

import { useEffect, useCallback } from 'react';
import { matchShortcut, DEFAULT_SHORTCUTS } from './shortcuts.js';
import type { ToolId } from './tool-state.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ShortcutHandlers = {
  // Edit
  readonly onUndo?: (() => void) | undefined;
  readonly onRedo?: (() => void) | undefined;
  readonly onDelete?: (() => void) | undefined;
  readonly onCopy?: (() => void) | undefined;
  readonly onPaste?: (() => void) | undefined;
  readonly onCut?: (() => void) | undefined;

  // Selection
  readonly onSelectAll?: (() => void) | undefined;
  readonly onDeselect?: (() => void) | undefined;
  readonly onNavigateNext?: (() => void) | undefined;
  readonly onNavigatePrev?: (() => void) | undefined;

  // View
  readonly onZoomIn?: (() => void) | undefined;
  readonly onZoomOut?: (() => void) | undefined;
  readonly onZoomFit?: (() => void) | undefined;

  // Tools
  readonly onToolSwitch?: ((toolId: ToolId) => void) | undefined;
};

// ---------------------------------------------------------------------------
// Tool action → ToolId mapping
// ---------------------------------------------------------------------------

/**
 * Map shortcut action names to ToolId values.
 * Domain tools (E7.2) like node placement are not yet
 * wired as ToolIds — they will be added when the tool
 * state machine is extended for domain-specific tools.
 */
const TOOL_ACTION_MAP: Readonly<Record<string, ToolId>> = {
  tool_select: 'select',
  tool_hand: 'hand',
  tool_rect: 'rectangle',
  tool_ellipse: 'ellipse',
  tool_poly: 'regular_polygon',
  tool_line: 'polyline',
  tool_pen: 'bezier',
  tool_text: 'text',
  tool_measure: 'measure',
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Central keyboard shortcut hook.
 *
 * Attaches a single keydown listener, matches against the shortcut
 * table, and dispatches to the provided handlers.
 *
 * Skips events when the target is an INPUT or TEXTAREA.
 */
export function useShortcuts(handlers: ShortcutHandlers): void {
  const dispatch = useCallback((action: string): boolean => {
    switch (action) {
      // Edit
      case 'undo':     handlers.onUndo?.();     return true;
      case 'redo':     handlers.onRedo?.();     return true;
      case 'delete':   handlers.onDelete?.();   return true;
      case 'copy':     handlers.onCopy?.();     return true;
      case 'paste':    handlers.onPaste?.();    return true;
      case 'cut':      handlers.onCut?.();      return true;

      // Selection
      case 'select_all':  handlers.onSelectAll?.();     return true;
      case 'deselect':    handlers.onDeselect?.();      return true;
      case 'nav_next':    handlers.onNavigateNext?.();  return true;
      case 'nav_prev':    handlers.onNavigatePrev?.();  return true;

      // View
      case 'zoom_in':   handlers.onZoomIn?.();   return true;
      case 'zoom_out':  handlers.onZoomOut?.();  return true;
      case 'zoom_fit':  handlers.onZoomFit?.();  return true;

      default: {
        // Tool switch
        const toolId = TOOL_ACTION_MAP[action];
        if (toolId !== undefined) {
          handlers.onToolSwitch?.(toolId);
          return true;
        }
        return false;
      }
    }
  }, [handlers]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Skip text inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const action = matchShortcut(e, DEFAULT_SHORTCUTS);
      if (action === null) return;

      const handled = dispatch(action);
      if (handled) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);
}
