import { describe, it, expect } from 'vitest';
import { guardAdRulesPack } from '../ad-rules.js';
import type { AdRulesPack } from '../ad-rules.js';

const pack: AdRulesPack = {
  key: 'ad-fr',
  version: '1.0.0',
  effective_from: '2026-01-01',
  source_ref: 'Code de la consommation, art. L121-1',
};

describe('I5.4 — guardAdRulesPack', () => {
  it('passes when an ad rules pack with a documentary reference is attached', () => {
    expect(guardAdRulesPack(pack).ok).toBe(true);
  });

  it('blocks when no ad rules pack is attached (no fallback)', () => {
    const r = guardAdRulesPack(null);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings[0]?.code).toBe('AD.RULES_PACK_MISSING');
    expect(r.findings[0]?.params['reason']).toBe('not_attached');
    expect(r.findings[0]?.ruleRef).toBe('I5.4');
  });

  it('blocks when the documentary reference is blank', () => {
    const r = guardAdRulesPack({ ...pack, source_ref: '   ' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings[0]?.params['reason']).toBe('source_ref_missing');
  });
});
