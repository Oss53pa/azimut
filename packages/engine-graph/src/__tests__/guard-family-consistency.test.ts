import { describe, it, expect } from 'vitest';
import {
  guardFamilyConsistency,
  type FamilyMember,
  type PictogramFamily,
} from '../guard-family-consistency.js';

const FAM: PictogramFamily = {
  id: 'fam-1',
  style: 'stroke',
  stroke_width: 2,
  grid: { cols: 24, rows: 24 },
};

const member = (over: Partial<FamilyMember> = {}): FamilyMember => ({
  id: 'p-1',
  family_id: 'fam-1',
  style: 'stroke',
  stroke_width: 2,
  grid: { cols: 24, rows: 24 },
  ...over,
});

describe('J5.2 — guardFamilyConsistency', () => {
  it('accepts a member matching its family on every axis', () => {
    const r = guardFamilyConsistency([member()], [FAM]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([]);
  });

  it('matches grid regardless of key order', () => {
    const r = guardFamilyConsistency(
      [member({ grid: { rows: 24, cols: 24 } })],
      [FAM],
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([]);
  });

  it('warns on a mixed style (stroke vs flat)', () => {
    const r = guardFamilyConsistency([member({ style: 'flat' })], [FAM]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings[0]?.code).toBe('PICTO.FAMILY_INCONSISTENT');
    expect(r.warnings[0]?.severity).toBe('warning');
    expect(r.warnings[0]?.ruleRef).toBe('J5.2');
    expect(r.warnings[0]?.params['axis']).toBe('style');
    expect(r.warnings[0]?.params['family_id']).toBe('fam-1');
  });

  it('warns on a divergent stroke width', () => {
    const r = guardFamilyConsistency([member({ stroke_width: 3 })], [FAM]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings[0]?.params['axis']).toBe('stroke_width');
  });

  it('ignores stroke width for a flat-fill family', () => {
    const flat: PictogramFamily = {
      id: 'fam-f',
      style: 'flat',
      stroke_width: null,
      grid: { g: 1 },
    };
    const r = guardFamilyConsistency(
      [member({ family_id: 'fam-f', style: 'flat', stroke_width: 9, grid: { g: 1 } })],
      [flat],
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([]);
  });

  it('warns on a divergent grid', () => {
    const r = guardFamilyConsistency([member({ grid: { cols: 16, rows: 16 } })], [FAM]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings[0]?.params['axis']).toBe('grid');
  });

  it('reports the first divergent axis in fixed order style > stroke_width > grid', () => {
    const r = guardFamilyConsistency(
      [member({ style: 'flat', stroke_width: 5, grid: { x: 0 } })],
      [FAM],
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings[0]?.params['axis']).toBe('style');
  });

  it('skips a member whose family is unknown', () => {
    const r = guardFamilyConsistency([member({ family_id: 'ghost' })], [FAM]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([]);
  });

  it('reports one warning per divergent member, sorted by id', () => {
    const r = guardFamilyConsistency(
      [
        member({ id: 'p-c', stroke_width: 3 }),
        member({ id: 'p-a' }),
        member({ id: 'p-b', style: 'flat' }),
      ],
      [FAM],
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings.map((w) => w.entity?.id)).toEqual(['p-b', 'p-c']);
  });
});
