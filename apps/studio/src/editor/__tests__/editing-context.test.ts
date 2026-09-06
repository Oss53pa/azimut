import { describe, it, expect } from 'vitest';
import { checkPermission, isAllowed } from '../editing-context.js';
import type { EditingContext, EditOperation } from '../editing-context.js';

describe('E1 — editing context enforcement', () => {
  describe('context 1: site', () => {
    const ctx: EditingContext = 'site';

    it('allows drawing shapes', () => {
      expect(isAllowed(ctx, 'draw_shape')).toBe(true);
    });

    it('allows moving objects', () => {
      expect(isAllowed(ctx, 'move_object')).toBe(true);
    });

    it('allows resizing objects', () => {
      expect(isAllowed(ctx, 'resize_object')).toBe(true);
    });

    it('allows typing text', () => {
      expect(isAllowed(ctx, 'type_text')).toBe(true);
    });

    it('allows choosing color via charter role', () => {
      expect(isAllowed(ctx, 'choose_color', { isCharterRole: true })).toBe(true);
    });

    it('denies choosing direct color (not charter role)', () => {
      expect(isAllowed(ctx, 'choose_color', { isCharterRole: false })).toBe(false);
    });

    it('allows adding images', () => {
      expect(isAllowed(ctx, 'add_image')).toBe(true);
    });

    it('denies modifying resolved content (sans objet)', () => {
      expect(isAllowed(ctx, 'modify_resolved_content')).toBe(false);
    });
  });

  describe('context 2: template', () => {
    const ctx: EditingContext = 'template';

    it('denies drawing shapes', () => {
      expect(isAllowed(ctx, 'draw_shape')).toBe(false);
    });

    it('allows moving template blocks', () => {
      expect(isAllowed(ctx, 'move_object', { isTemplateBlock: true })).toBe(true);
    });

    it('denies moving non-block objects', () => {
      expect(isAllowed(ctx, 'move_object', { isTemplateBlock: false })).toBe(false);
    });

    it('allows resizing template zones', () => {
      expect(isAllowed(ctx, 'resize_object', { isTemplateBlock: true })).toBe(true);
    });

    it('denies resizing non-block objects', () => {
      expect(isAllowed(ctx, 'resize_object')).toBe(false);
    });

    it('denies typing text', () => {
      expect(isAllowed(ctx, 'type_text')).toBe(false);
    });

    it('allows choosing charter role colors', () => {
      expect(isAllowed(ctx, 'choose_color', { isCharterRole: true })).toBe(true);
    });

    it('denies direct colors', () => {
      expect(isAllowed(ctx, 'choose_color')).toBe(false);
    });

    it('denies adding images', () => {
      expect(isAllowed(ctx, 'add_image')).toBe(false);
    });

    it('denies modifying resolved content', () => {
      expect(isAllowed(ctx, 'modify_resolved_content')).toBe(false);
    });
  });

  describe('context 3: face', () => {
    const ctx: EditingContext = 'face';

    it('denies drawing shapes', () => {
      expect(isAllowed(ctx, 'draw_shape')).toBe(false);
    });

    it('denies moving objects', () => {
      expect(isAllowed(ctx, 'move_object')).toBe(false);
    });

    it('denies resizing objects', () => {
      expect(isAllowed(ctx, 'resize_object')).toBe(false);
    });

    it('allows typing in free blocks only', () => {
      expect(isAllowed(ctx, 'type_text', { isFreeBlock: true })).toBe(true);
    });

    it('denies typing in non-free blocks', () => {
      expect(isAllowed(ctx, 'type_text', { isFreeBlock: false })).toBe(false);
    });

    it('denies typing without qualifier', () => {
      expect(isAllowed(ctx, 'type_text')).toBe(false);
    });

    it('denies choosing colors', () => {
      expect(isAllowed(ctx, 'choose_color')).toBe(false);
    });

    it('denies adding images', () => {
      expect(isAllowed(ctx, 'add_image')).toBe(false);
    });

    it('denies modifying resolved content', () => {
      expect(isAllowed(ctx, 'modify_resolved_content')).toBe(false);
    });
  });

  describe('checkPermission returns Finding', () => {
    it('returns null when allowed', () => {
      expect(checkPermission('site', 'draw_shape')).toBeNull();
    });

    it('returns EDIT.CONTEXT_VIOLATION when denied', () => {
      const finding = checkPermission('face', 'draw_shape');
      expect(finding).not.toBeNull();
      expect(finding?.code).toBe('EDIT.CONTEXT_VIOLATION');
      expect(finding?.severity).toBe('blocking');
      expect(finding?.ruleRef).toBe('E1.4');
    });

    it('finding params include context and operation labels', () => {
      const finding = checkPermission('face', 'move_object');
      expect(finding?.params['context']).toBe('face');
      expect(finding?.params['operation']).toBe('move_object');
      expect(finding?.params['context_label']).toBe('face de support');
      expect(finding?.params['operation_label']).toBe('déplacer un objet');
    });
  });

  describe('exhaustive E1.4 matrix (all 21 combinations)', () => {
    const ops: EditOperation[] = [
      'draw_shape', 'move_object', 'resize_object',
      'type_text', 'choose_color', 'add_image', 'modify_resolved_content',
    ];
    const contexts: EditingContext[] = ['site', 'template', 'face'];

    it('every combination returns a boolean without throwing', () => {
      for (const ctx of contexts) {
        for (const op of ops) {
          const result = isAllowed(ctx, op);
          expect(typeof result).toBe('boolean');
        }
      }
    });
  });
});
