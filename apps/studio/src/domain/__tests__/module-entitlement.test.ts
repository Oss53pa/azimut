import { describe, it, expect } from 'vitest';
import {
  isModuleNavigable,
  isModuleExportReadable,
  guardModuleOperation,
  type ModuleEntitlement,
} from '../module-entitlement.js';

const ent = (
  state: ModuleEntitlement['state'],
  from_date = '2026-01-01',
  to_date: string | null = null,
  module_key = 'atelier',
): ModuleEntitlement => ({ module_key, state, from_date, to_date });

const AT = '2026-06-01';

describe('I5.2 — module entitlement (application layer)', () => {
  describe('isModuleNavigable', () => {
    it('is true for an active or trial subscription covering the date', () => {
      expect(isModuleNavigable([ent('active')], 'atelier', AT)).toBe(true);
      expect(isModuleNavigable([ent('trial')], 'atelier', AT)).toBe(true);
    });

    it('is false for suspended, expired, or absent modules', () => {
      expect(isModuleNavigable([ent('suspended')], 'atelier', AT)).toBe(false);
      expect(isModuleNavigable([ent('expired')], 'atelier', AT)).toBe(false);
      expect(isModuleNavigable([], 'atelier', AT)).toBe(false);
    });

    it('respects the date window', () => {
      expect(
        isModuleNavigable([ent('active', '2026-07-01')], 'atelier', AT),
      ).toBe(false);
      expect(
        isModuleNavigable([ent('active', '2026-01-01', '2026-03-01')], 'atelier', AT),
      ).toBe(false);
    });

    it('takes the most permissive covering row', () => {
      expect(
        isModuleNavigable([ent('suspended'), ent('active')], 'atelier', AT),
      ).toBe(true);
    });
  });

  describe('isModuleExportReadable', () => {
    it('keeps suspended data readable in export', () => {
      expect(isModuleExportReadable([ent('suspended')], 'atelier', AT)).toBe(true);
    });

    it('is false for expired or absent modules', () => {
      expect(isModuleExportReadable([ent('expired')], 'atelier', AT)).toBe(false);
      expect(isModuleExportReadable([], 'atelier', AT)).toBe(false);
    });
  });

  describe('guardModuleOperation', () => {
    it('passes for an entitled module', () => {
      const r = guardModuleOperation([ent('active')], 'atelier', AT);
      expect(r.ok).toBe(true);
    });

    it('blocks MODULE.NOT_ENTITLED for an absent module', () => {
      const r = guardModuleOperation([], 'regie', AT);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.findings[0]?.code).toBe('MODULE.NOT_ENTITLED');
      expect(r.findings[0]?.severity).toBe('blocking');
      expect(r.findings[0]?.ruleRef).toBe('I5.2');
      expect(r.findings[0]?.entity).toEqual({ kind: 'module', id: 'regie' });
      expect(r.findings[0]?.params['state']).toBe('absent');
    });

    it('blocks a suspended module and reports its state', () => {
      const r = guardModuleOperation([ent('suspended')], 'atelier', AT);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.findings[0]?.params['state']).toBe('suspended');
    });
  });
});
