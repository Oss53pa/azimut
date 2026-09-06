/**
 * Tests for clipboard integration.
 *
 * Tests the underlying pure functions (clipboard.ts), not the React hook.
 * The hook is thin wiring — keyboard listeners + state updates.
 */

import { describe, it, expect } from 'vitest';
import {
  copyToClipboard,
  cutToClipboard,
  preparePaste,
  hasClipboard,
  clipboardItemCount,
  EMPTY_CLIPBOARD,
  PASTE_OFFSET_M,
} from '../clipboard.js';
import type { ClipboardPayload, PasteContext } from '../clipboard.js';

const PAYLOAD: ClipboardPayload = {
  sourceOrgId: 'org-1',
  sourceSiteId: 'site-1',
  sourceLevelId: 'level-1',
  items: [
    { type: 'footprint', geometry: null, properties: {} },
    { type: 'node', geometry: null, properties: { kind: 'door' } },
  ],
  centroid: { x_m: 5, y_m: 5 },
};

const SAME_LEVEL: PasteContext = {
  targetOrgId: 'org-1',
  targetSiteId: 'site-1',
  targetLevelId: 'level-1',
};

const CROSS_LEVEL: PasteContext = {
  targetOrgId: 'org-1',
  targetSiteId: 'site-1',
  targetLevelId: 'level-2',
};

const CROSS_ORG: PasteContext = {
  targetOrgId: 'org-2',
  targetSiteId: 'site-x',
  targetLevelId: 'level-y',
};

const CENTER = { x_m: 10, y_m: 10 };

describe('E7.3 — clipboard integration', () => {
  describe('copy / cut', () => {
    it('copy stores payload in clipboard', () => {
      const state = copyToClipboard(EMPTY_CLIPBOARD, PAYLOAD);
      expect(state.payload).toBe(PAYLOAD);
    });

    it('cut stores payload (same as copy)', () => {
      const state = cutToClipboard(EMPTY_CLIPBOARD, PAYLOAD);
      expect(state.payload).toBe(PAYLOAD);
    });

    it('copy replaces existing clipboard', () => {
      const first = copyToClipboard(EMPTY_CLIPBOARD, PAYLOAD);
      const newPayload = { ...PAYLOAD, sourceOrgId: 'org-2' };
      const second = copyToClipboard(first, newPayload);
      expect(second.payload?.sourceOrgId).toBe('org-2');
    });
  });

  describe('hasClipboard / clipboardItemCount', () => {
    it('empty clipboard has no items', () => {
      expect(hasClipboard(EMPTY_CLIPBOARD)).toBe(false);
      expect(clipboardItemCount(EMPTY_CLIPBOARD)).toBe(0);
    });

    it('clipboard with payload reports items', () => {
      const state = copyToClipboard(EMPTY_CLIPBOARD, PAYLOAD);
      expect(hasClipboard(state)).toBe(true);
      expect(clipboardItemCount(state)).toBe(2);
    });
  });

  describe('preparePaste', () => {
    it('fails on empty clipboard', () => {
      const result = preparePaste(EMPTY_CLIPBOARD, SAME_LEVEL, CENTER);
      expect(result.ok).toBe(false);
    });

    it('fails on cross-org paste', () => {
      const state = copyToClipboard(EMPTY_CLIPBOARD, PAYLOAD);
      const result = preparePaste(state, CROSS_ORG, CENTER);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.finding.code).toBe('EDIT.CROSS_ORG_PASTE_DENIED');
      }
    });

    it('same-level paste applies offset', () => {
      const state = copyToClipboard(EMPTY_CLIPBOARD, PAYLOAD);
      const result = preparePaste(state, SAME_LEVEL, CENTER);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.offset.x_m).toBe(PASTE_OFFSET_M);
        expect(result.offset.y_m).toBe(PASTE_OFFSET_M);
        expect(result.items).toHaveLength(2);
      }
    });

    it('cross-level paste centers at viewport', () => {
      const state = copyToClipboard(EMPTY_CLIPBOARD, PAYLOAD);
      const result = preparePaste(state, CROSS_LEVEL, CENTER);
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Offset should move centroid (5,5) to viewport center (10,10)
        expect(result.offset.x_m).toBe(5);
        expect(result.offset.y_m).toBe(5);
      }
    });

    it('cross-site same-org paste centers at viewport', () => {
      const crossSite: PasteContext = {
        targetOrgId: 'org-1',
        targetSiteId: 'site-other',
        targetLevelId: 'level-1',
      };
      const state = copyToClipboard(EMPTY_CLIPBOARD, PAYLOAD);
      const result = preparePaste(state, crossSite, CENTER);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.offset.x_m).toBe(5);
        expect(result.offset.y_m).toBe(5);
      }
    });
  });
});
