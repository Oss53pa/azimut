/**
 * E1.4 — Editing context guard.
 *
 * Wraps tool actions with permission checks against the editing context.
 * Before any tool mutation reaches the tool reducer, the guard checks
 * the permission matrix (editing-context.ts).
 *
 * Three contexts:
 *   Context 1 (site geometry) — full editing
 *   Context 2 (templates)     — visual editing, produces data only
 *   Context 3 (support faces) — NO editing, view/control only
 *
 * "Toute demande d'assouplissement de la colonne « contexte 3 »
 *  relève de la procédure d'arrêt et de demande." (E1.4)
 *
 * The guard returns the action unchanged if permitted, or null
 * (+ a Finding) if blocked. The caller decides whether to show
 * the Finding in the UI.
 */

import type { Finding } from '@azimut/core-model';
import type { EditingContext, EditOperation } from './editing-context.js';
import { checkPermission, isAllowed } from './editing-context.js';
import type { ToolId, ToolAction } from './tool-state.js';

// ---------------------------------------------------------------------------
// Tool → operation mapping
// ---------------------------------------------------------------------------

/**
 * Map a tool id to the editing operation it requires.
 *
 * Navigation tools (hand, zoom) don't require edit permission.
 * Selection tools are view-only in context 3.
 */
function toolToOperation(toolId: ToolId): EditOperation | null {
  switch (toolId) {
    case 'hand':
    case 'zoom_tool':
      return null; // Always allowed (navigation)
    case 'select':
    case 'direct_select':
      return null; // Selection is inspection, always allowed
    case 'rectangle':
    case 'ellipse':
    case 'regular_polygon':
    case 'polyline':
    case 'bezier':
      return 'draw_shape';
    case 'text':
      return 'type_text';
    case 'measure':
    case 'dimension':
      return 'draw_shape'; // Annotations require draw_shape permission
  }
}

// ---------------------------------------------------------------------------
// Guard result
// ---------------------------------------------------------------------------

export type GuardResult =
  | { readonly allowed: true; readonly action: ToolAction }
  | { readonly allowed: false; readonly finding: Finding };

// ---------------------------------------------------------------------------
// Guard function
// ---------------------------------------------------------------------------

/**
 * Check if a tool action is permitted in the current editing context.
 *
 * @param action - Tool action to check.
 * @param context - Current editing context.
 * @returns GuardResult — allowed (with action) or blocked (with finding).
 */
export function guardToolAction(
  action: ToolAction,
  context: EditingContext,
): GuardResult {
  // Tool switch: check if the new tool is allowed
  if (action.type === 'set_tool') {
    const operation = toolToOperation(action.tool);
    if (operation === null) {
      return { allowed: true, action };
    }
    if (isAllowed(context, operation)) {
      return { allowed: true, action };
    }
    const finding = checkPermission(context, operation);
    if (finding !== null) {
      return { allowed: false, finding };
    }
    // Should not happen if isAllowed returned false
    return { allowed: true, action };
  }

  // Polygon sides change: always allowed (configuration, not editing)
  if (action.type === 'set_polygon_sides') {
    return { allowed: true, action };
  }

  // Gesture events: checked based on current tool (which was already
  // validated when set_tool was dispatched). Pass through.
  return { allowed: true, action };
}

/**
 * Get the list of tools available in a given editing context.
 *
 * Used by the Toolbar to disable/hide unavailable tools.
 */
export function availableTools(context: EditingContext): readonly ToolId[] {
  const all: ToolId[] = [
    'select', 'direct_select', 'hand', 'zoom_tool',
    'rectangle', 'ellipse', 'regular_polygon',
    'polyline', 'bezier', 'text',
    'dimension', 'measure',
  ];

  return all.filter(tool => {
    const op = toolToOperation(tool);
    return op === null || isAllowed(context, op);
  });
}
