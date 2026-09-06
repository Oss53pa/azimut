/**
 * E7.3 — Clipboard: copy, cut, paste within editing context 1.
 *
 * Copy-paste between levels and between sites of the SAME organization
 * is allowed. Copy-paste between organizations is forbidden and
 * returns EDIT.CROSS_ORG_PASTE_DENIED (E17).
 *
 * The clipboard stores serializable data, not object references.
 * Pasting creates new ids. Position offset is applied to avoid
 * exact overlap with the source.
 */

import type { Point, Finding } from '@azimut/core-model';

// ---------------------------------------------------------------------------
// Clipboard payload
// ---------------------------------------------------------------------------

export type ClipboardItem = {
  readonly type: string;
  readonly geometry: unknown;
  readonly properties: Readonly<Record<string, unknown>>;
};

export type ClipboardPayload = {
  /** Organization id of the source data. */
  readonly sourceOrgId: string;
  /** Site id of the source. */
  readonly sourceSiteId: string;
  /** Level id of the source. */
  readonly sourceLevelId: string;
  /** Copied items, in selection order. */
  readonly items: readonly ClipboardItem[];
  /** Position of the centroid at copy time. */
  readonly centroid: Point;
};

export type ClipboardState = {
  readonly payload: ClipboardPayload | null;
};

export const EMPTY_CLIPBOARD: ClipboardState = { payload: null };

// ---------------------------------------------------------------------------
// Paste offset
// ---------------------------------------------------------------------------

/**
 * Offset in meters to apply when pasting on the same level,
 * to avoid exact overlap.
 */
export const PASTE_OFFSET_M = 0.5;

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

export function copyToClipboard(
  state: ClipboardState,
  payload: ClipboardPayload,
): ClipboardState {
  return { payload };
}

// ---------------------------------------------------------------------------
// Cut (copy + delete source — deletion handled externally)
// ---------------------------------------------------------------------------

export function cutToClipboard(
  state: ClipboardState,
  payload: ClipboardPayload,
): ClipboardState {
  return { payload };
}

// ---------------------------------------------------------------------------
// Paste validation
// ---------------------------------------------------------------------------

export type PasteContext = {
  readonly targetOrgId: string;
  readonly targetSiteId: string;
  readonly targetLevelId: string;
};

export type PasteResult =
  | { readonly ok: true; readonly items: readonly ClipboardItem[]; readonly offset: Point }
  | { readonly ok: false; readonly finding: Finding };

/**
 * Validate and prepare a paste operation.
 *
 * Cross-organization paste is denied (E7.3).
 * Same-level paste applies PASTE_OFFSET_M so shapes don't overlap.
 * Cross-level/cross-site paste centers items at the viewport center.
 */
export function preparePaste(
  clipboard: ClipboardState,
  target: PasteContext,
  viewportCenter: Point,
): PasteResult {
  if (clipboard.payload === null) {
    return {
      ok: false,
      finding: {
        code: 'EDIT.CROSS_ORG_PASTE_DENIED',
        severity: 'blocking',
        entity: null,
        params: { reason: 'clipboard_empty' },
        ruleRef: 'E7.3',
      },
    };
  }

  const payload = clipboard.payload;

  // Cross-org check
  if (payload.sourceOrgId !== target.targetOrgId) {
    return {
      ok: false,
      finding: {
        code: 'EDIT.CROSS_ORG_PASTE_DENIED',
        severity: 'blocking',
        entity: null,
        params: {
          sourceOrg: payload.sourceOrgId,
          targetOrg: target.targetOrgId,
        },
        ruleRef: 'E7.3',
      },
    };
  }

  // Same level: offset to avoid overlap
  if (
    payload.sourceSiteId === target.targetSiteId &&
    payload.sourceLevelId === target.targetLevelId
  ) {
    return {
      ok: true,
      items: payload.items,
      offset: { x_m: PASTE_OFFSET_M, y_m: PASTE_OFFSET_M },
    };
  }

  // Cross-level or cross-site (same org): center at viewport
  const offset: Point = {
    x_m: viewportCenter.x_m - payload.centroid.x_m,
    y_m: viewportCenter.y_m - payload.centroid.y_m,
  };

  return { ok: true, items: payload.items, offset };
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

export function hasClipboard(state: ClipboardState): boolean {
  return state.payload !== null;
}

export function clipboardItemCount(state: ClipboardState): number {
  return state.payload?.items.length ?? 0;
}
