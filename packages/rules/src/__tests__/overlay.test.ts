import { describe, it, expect } from 'vitest';
import { loadRulesPack, resolveRule, type LoadedRulesPack } from '../loader.js';
import { mergeCountryOverlay } from '../overlay.js';

type RuleInput = {
  code: string;
  scope?: Record<string, string>;
  params: Record<string, string | number | boolean>;
  constraint?: { key: string; tighten: string };
  source_ref?: string;
};

function pack(
  key: string,
  jurisdiction: string,
  rules: RuleInput[],
): LoadedRulesPack {
  const result = loadRulesPack(
    JSON.stringify({
      key,
      version: '1.0',
      jurisdiction,
      effective_from: '2024-01-01',
      source_ref: 'Ref',
      rules: rules.map((r) => ({
        code: r.code,
        scope: r.scope ?? {},
        params: r.params,
        ...(r.constraint ? { constraint: r.constraint } : {}),
        source_ref: r.source_ref ?? 'ref',
      })),
    }),
  );
  if (!result.ok) {
    throw new Error(`pack should load: ${JSON.stringify(result.findings)}`);
  }
  return result.value;
}

describe('D3.6 — mergeCountryOverlay', () => {
  it('applies a stricter country rule (higher)', () => {
    const base = pack('intl', 'INTL', [
      { code: 'MIN_H', params: { minimum_mm: 20 }, source_ref: 'base' },
    ]);
    const fr = pack('fr', 'FR', [
      {
        code: 'MIN_H',
        params: { minimum_mm: 30 },
        constraint: { key: 'minimum_mm', tighten: 'higher' },
        source_ref: 'fr',
      },
    ]);
    const merged = mergeCountryOverlay(base, fr);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    expect(merged.value.jurisdiction).toBe('FR');
    const r = resolveRule(merged.value, 'MIN_H');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.params['minimum_mm']).toBe(30);
      expect(r.value.source_ref).toBe('fr');
    }
  });

  it('accepts an equally-constraining country rule', () => {
    const base = pack('intl', 'INTL', [
      { code: 'MIN_H', params: { minimum_mm: 20 }, source_ref: 'base' },
    ]);
    const fr = pack('fr', 'FR', [
      {
        code: 'MIN_H',
        params: { minimum_mm: 20 },
        constraint: { key: 'minimum_mm', tighten: 'higher' },
        source_ref: 'fr',
      },
    ]);
    const merged = mergeCountryOverlay(base, fr);
    expect(merged.ok).toBe(true);
    if (merged.ok) {
      const r = resolveRule(merged.value, 'MIN_H');
      if (r.ok) expect(r.value.source_ref).toBe('fr');
    }
  });

  it('rejects a less-constraining country rule (higher)', () => {
    const base = pack('intl', 'INTL', [
      { code: 'MIN_H', params: { minimum_mm: 20 }, source_ref: 'base' },
    ]);
    const fr = pack('fr', 'FR', [
      {
        code: 'MIN_H',
        params: { minimum_mm: 10 },
        constraint: { key: 'minimum_mm', tighten: 'higher' },
        source_ref: 'fr',
      },
    ]);
    const merged = mergeCountryOverlay(base, fr);
    expect(merged.ok).toBe(false);
    if (merged.ok) return;
    expect(merged.findings[0]?.code).toBe('RULES.OVERLAY_LESS_RESTRICTIVE');
  });

  it('handles the "lower is stricter" direction', () => {
    const base = pack('intl', 'INTL', [
      { code: 'MAX_SPACING', params: { max_mm: 100 }, source_ref: 'base' },
    ]);
    const stricter = pack('fr', 'FR', [
      {
        code: 'MAX_SPACING',
        params: { max_mm: 80 },
        constraint: { key: 'max_mm', tighten: 'lower' },
        source_ref: 'fr',
      },
    ]);
    const looser = pack('fr', 'FR', [
      {
        code: 'MAX_SPACING',
        params: { max_mm: 120 },
        constraint: { key: 'max_mm', tighten: 'lower' },
        source_ref: 'fr',
      },
    ]);
    expect(mergeCountryOverlay(base, stricter).ok).toBe(true);
    const bad = mergeCountryOverlay(base, looser);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.findings[0]?.code).toBe('RULES.OVERLAY_LESS_RESTRICTIVE');
    }
  });

  it('handles boolean-true tightening', () => {
    const base = pack('intl', 'INTL', [
      { code: 'REQ_TACTILE', params: { required: false }, source_ref: 'base' },
    ]);
    const stricter = pack('fr', 'FR', [
      {
        code: 'REQ_TACTILE',
        params: { required: true },
        constraint: { key: 'required', tighten: 'boolean-true' },
        source_ref: 'fr',
      },
    ]);
    expect(mergeCountryOverlay(base, stricter).ok).toBe(true);

    const base2 = pack('intl', 'INTL', [
      { code: 'REQ_TACTILE', params: { required: true }, source_ref: 'base' },
    ]);
    const looser = pack('fr', 'FR', [
      {
        code: 'REQ_TACTILE',
        params: { required: false },
        constraint: { key: 'required', tighten: 'boolean-true' },
        source_ref: 'fr',
      },
    ]);
    const bad = mergeCountryOverlay(base2, looser);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.findings[0]?.code).toBe('RULES.OVERLAY_LESS_RESTRICTIVE');
    }
  });

  it('keeps the base rule and warns when the country rule is not comparable', () => {
    const base = pack('intl', 'INTL', [
      { code: 'MIN_H', params: { minimum_mm: 20 }, source_ref: 'base' },
    ]);
    // No `constraint` declared → direction unknown → not comparable.
    const fr = pack('fr', 'FR', [
      { code: 'MIN_H', params: { minimum_mm: 30 }, source_ref: 'fr' },
    ]);
    const merged = mergeCountryOverlay(base, fr);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    expect(merged.warnings).toHaveLength(1);
    expect(merged.warnings[0]?.code).toBe('RULES.OVERLAY_NOT_COMPARABLE');
    // Base rule is kept (socle preserved).
    const r = resolveRule(merged.value, 'MIN_H');
    if (r.ok) {
      expect(r.value.params['minimum_mm']).toBe(20);
      expect(r.value.source_ref).toBe('base');
    }
  });

  it('treats a type mismatch on the compared param as not comparable', () => {
    const base = pack('intl', 'INTL', [
      { code: 'MIN_H', params: { minimum_mm: 'twenty' }, source_ref: 'base' },
    ]);
    const fr = pack('fr', 'FR', [
      {
        code: 'MIN_H',
        params: { minimum_mm: 30 },
        constraint: { key: 'minimum_mm', tighten: 'higher' },
        source_ref: 'fr',
      },
    ]);
    const merged = mergeCountryOverlay(base, fr);
    expect(merged.ok).toBe(true);
    if (merged.ok) {
      expect(merged.warnings[0]?.code).toBe('RULES.OVERLAY_NOT_COMPARABLE');
    }
  });

  it('layers in an additive country rule with no base match', () => {
    const base = pack('intl', 'INTL', [
      { code: 'MIN_H', params: { minimum_mm: 20 }, source_ref: 'base' },
    ]);
    const fr = pack('fr', 'FR', [
      { code: 'FR_ONLY', params: { v: 1 }, source_ref: 'fr' },
    ]);
    const merged = mergeCountryOverlay(base, fr);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    expect(resolveRule(merged.value, 'MIN_H').ok).toBe(true);
    expect(resolveRule(merged.value, 'FR_ONLY').ok).toBe(true);
  });

  it('overrides only the matching scope, keeping other scopes of the same code', () => {
    const base = pack('intl', 'INTL', [
      { code: 'MIN_H', scope: {}, params: { minimum_mm: 20 }, source_ref: 'base' },
      {
        code: 'MIN_H',
        scope: { supportRegistry: 'wayfinding' },
        params: { minimum_mm: 25 },
        source_ref: 'base',
      },
    ]);
    const fr = pack('fr', 'FR', [
      {
        code: 'MIN_H',
        scope: { supportRegistry: 'wayfinding' },
        params: { minimum_mm: 40 },
        constraint: { key: 'minimum_mm', tighten: 'higher' },
        source_ref: 'fr',
      },
    ]);
    const merged = mergeCountryOverlay(base, fr);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    const broad = resolveRule(merged.value, 'MIN_H', {});
    if (broad.ok) expect(broad.value.params['minimum_mm']).toBe(20);
    const specific = resolveRule(merged.value, 'MIN_H', {
      supportRegistry: 'wayfinding',
    });
    if (specific.ok) expect(specific.value.params['minimum_mm']).toBe(40);
  });
});
