import { describe, it, expect } from 'vitest';
import {
  EMPTY_CLIPBOARD,
  PASTE_OFFSET_M,
  copyToClipboard,
  cutToClipboard,
  preparePaste,
  hasClipboard,
  clipboardItemCount,
} from '../clipboard.js';
import type { ClipboardPayload, PasteContext } from '../clipboard.js';

function payload(overrides: Partial<ClipboardPayload> = {}): ClipboardPayload {
  return {
    sourceOrgId: 'org-1',
    sourceSiteId: 'site-1',
    sourceLevelId: 'level-1',
    items: [
      { type: 'footprint', geometry: { points: [] }, properties: {} },
    ],
    centroid: { x_m: 5, y_m: 5 },
    ...overrides,
  };
}

const sameTarget: PasteContext = {
  targetOrgId: 'org-1',
  targetSiteId: 'site-1',
  targetLevelId: 'level-1',
};

const crossLevelTarget: PasteContext = {
  targetOrgId: 'org-1',
  targetSiteId: 'site-1',
  targetLevelId: 'level-2',
};

const crossOrgTarget: PasteContext = {
  targetOrgId: 'org-2',
  targetSiteId: 'site-x',
  targetLevelId: 'level-x',
};

describe('E7.3 — clipboard', () => {
  describe('empty clipboard', () => {
    it('starts empty', () => {
      expect(hasClipboard(EMPTY_CLIPBOARD)).toBe(false);
      expect(clipboardItemCount(EMPTY_CLIPBOARD)).toBe(0);
    });
  });

  describe('copyToClipboard', () => {
    it('stores the payload', () => {
      const p = payload();
      const state = copyToClipboard(EMPTY_CLIPBOARD, p);
      expect(hasClipboard(state)).toBe(true);
      expect(clipboardItemCount(state)).toBe(1);
    });
  });

  describe('cutToClipboard', () => {
    it('stores the payload (same as copy)', () => {
      const p = payload();
      const state = cutToClipboard(EMPTY_CLIPBOARD, p);
      expect(hasClipboard(state)).toBe(true);
    });
  });

  describe('preparePaste', () => {
    it('denies paste from empty clipboard', () => {
      const result = preparePaste(EMPTY_CLIPBOARD, sameTarget, { x_m: 0, y_m: 0 });
      expect(result.ok).toBe(false);
    });

    it('denies cross-organization paste (E7.3)', () => {
      const state = copyToClipboard(EMPTY_CLIPBOARD, payload());
      const result = preparePaste(state, crossOrgTarget, { x_m: 0, y_m: 0 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.finding.code).toBe('EDIT.CROSS_ORG_PASTE_DENIED');
        expect(result.finding.severity).toBe('blocking');
      }
    });

    it('same-level paste applies offset', () => {
      const state = copyToClipboard(EMPTY_CLIPBOARD, payload());
      const result = preparePaste(state, sameTarget, { x_m: 10, y_m: 10 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.offset.x_m).toBe(PASTE_OFFSET_M);
        expect(result.offset.y_m).toBe(PASTE_OFFSET_M);
      }
    });

    it('cross-level paste centers at viewport', () => {
      const p = payload({ centroid: { x_m: 5, y_m: 5 } });
      const state = copyToClipboard(EMPTY_CLIPBOARD, p);
      const viewCenter = { x_m: 20, y_m: 30 };
      const result = preparePaste(state, crossLevelTarget, viewCenter);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.offset.x_m).toBe(15); // 20 - 5
        expect(result.offset.y_m).toBe(25); // 30 - 5
      }
    });

    it('cross-site (same org) paste centers at viewport', () => {
      const target: PasteContext = {
        targetOrgId: 'org-1',
        targetSiteId: 'site-2',
        targetLevelId: 'level-1',
      };
      const p = payload({ centroid: { x_m: 0, y_m: 0 } });
      const state = copyToClipboard(EMPTY_CLIPBOARD, p);
      const viewCenter = { x_m: 10, y_m: 10 };
      const result = preparePaste(state, target, viewCenter);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.offset.x_m).toBe(10);
        expect(result.offset.y_m).toBe(10);
      }
    });

    it('preserves items in result', () => {
      const items = [
        { type: 'footprint', geometry: {}, properties: {} },
        { type: 'node', geometry: {}, properties: {} },
      ];
      const state = copyToClipboard(EMPTY_CLIPBOARD, payload({ items }));
      const result = preparePaste(state, sameTarget, { x_m: 0, y_m: 0 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.items).toHaveLength(2);
      }
    });
  });
});
