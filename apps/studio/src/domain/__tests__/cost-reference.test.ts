import { describe, it, expect } from 'vitest';
import { auditCostReferences } from '../cost-reference.js';

describe('H8 — auditCostReferences (COST.REFERENCE_MISSING)', () => {
  it('reports nothing when every referenced typology is priced', () => {
    const r = auditCostReferences(['totem', 'directional'], new Set(['totem', 'directional']));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([]);
  });

  it('warns for a typology without a reference cost', () => {
    const r = auditCostReferences(['totem', 'flag'], new Set(['totem']));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings[0]?.code).toBe('COST.REFERENCE_MISSING');
    expect(r.warnings[0]?.severity).toBe('warning');
    expect(r.warnings[0]?.ruleRef).toBe('H8');
    expect(r.warnings[0]?.entity).toEqual({ kind: 'support_type', id: 'flag' });
  });

  it('de-duplicates and sorts missing typologies', () => {
    const r = auditCostReferences(
      ['flag', 'banner', 'flag', 'banner'],
      new Set<string>(),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings.map((w) => w.entity?.id)).toEqual(['banner', 'flag']);
  });

  it('is a no-op for no references', () => {
    const r = auditCostReferences([], new Set(['totem']));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([]);
  });
});
