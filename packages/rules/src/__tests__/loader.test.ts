import { describe, it, expect } from 'vitest';
import { loadRulesPack } from '../loader.js';
import {
  resolveRule,
  scopeSpecificity,
  groupAndCheckAmbiguity,
} from '../rule-resolution.js';
import { validPack, makeRule } from './loader-fixtures.js';

describe('scopeSpecificity', () => {
  it('returns 0 for empty scope', () => {
    expect(scopeSpecificity({})).toBe(0);
  });

  it('weights each dimension by D3.5 priority (supportRegistry > context > sectorKey)', () => {
    expect(scopeSpecificity({ supportRegistry: 'wayfinding' })).toBe(4);
    expect(scopeSpecificity({ context: 'interior' })).toBe(2);
    expect(scopeSpecificity({ sectorKey: 'commercial' })).toBe(1);
  });

  it('supportRegistry outranks any combination of lower dimensions', () => {
    // 4 > 2 + 1: a supportRegistry-only scope is more specific than one
    // carrying both context and sectorKey.
    expect(scopeSpecificity({ supportRegistry: 'wayfinding' })).toBeGreaterThan(
      scopeSpecificity({ context: 'interior', sectorKey: 'commercial' }),
    );
  });

  it('sums bit weights for combined scopes', () => {
    expect(scopeSpecificity({
      supportRegistry: 'wayfinding',
      context: 'interior',
    })).toBe(6);
    expect(scopeSpecificity({
      supportRegistry: 'wayfinding',
      context: 'interior',
      sectorKey: 'commercial',
    })).toBe(7);
  });
});

describe('groupAndCheckAmbiguity', () => {
  it('groups a single rule', () => {
    const result = groupAndCheckAmbiguity([makeRule('R1', {})]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.size).toBe(1);
    const group = result.value.get('R1');
    expect(group).toHaveLength(1);
  });

  it('groups distinct codes without ambiguity', () => {
    const result = groupAndCheckAmbiguity([
      makeRule('R1', {}),
      makeRule('R2', { supportRegistry: 'wayfinding' }),
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.size).toBe(2);
  });

  it('accepts same code at different specificities', () => {
    const result = groupAndCheckAmbiguity([
      makeRule('R1', {}),
      makeRule('R1', { supportRegistry: 'wayfinding' }),
    ]);
    expect(result.ok).toBe(true);
  });

  it('rejects same code with an identical scope', () => {
    const result = groupAndCheckAmbiguity([
      makeRule('R1', { context: 'interior' }),
      makeRule('R1', { context: 'interior' }),
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('RULES.SCOPE_AMBIGUOUS');
    expect(result.findings[0]?.params['rule_code']).toBe('R1');
    // Both scopes carry only `context` → specificity 2 (D3.5 bit weights).
    expect(result.findings[0]?.params['specificity']).toBe(2);
  });

  it('accepts same code, same dimension, different values (scope partition)', () => {
    // interior vs exterior share the dimension set but never match one context,
    // so they partition the scope space and are not ambiguous.
    const result = groupAndCheckAmbiguity([
      makeRule('R1', { context: 'interior' }),
      makeRule('R1', { context: 'exterior' }),
    ]);
    expect(result.ok).toBe(true);
  });

  it('does not flag supportRegistry vs context as ambiguous (D3.5 order)', () => {
    // Different scope dimensions are different specificities: supportRegistry
    // (4) outranks context (2), so there is a deterministic winner.
    const result = groupAndCheckAmbiguity([
      makeRule('R1', { context: 'interior' }),
      makeRule('R1', { supportRegistry: 'wayfinding' }),
    ]);
    expect(result.ok).toBe(true);
  });

  it('returns ok for empty array', () => {
    const result = groupAndCheckAmbiguity([]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.size).toBe(0);
  });

  it('reports only ambiguous codes, not others', () => {
    const result = groupAndCheckAmbiguity([
      makeRule('R1', { context: 'interior' }),
      makeRule('R1', { context: 'interior' }),
      makeRule('R2', {}),
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.params['rule_code']).toBe('R1');
  });
});

describe('loadRulesPack', () => {
  it('loads a valid pack', () => {
    const result = loadRulesPack(validPack());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.key).toBe('erp-france');
    expect(result.value.version).toBe('2024.1');
    expect(result.value.jurisdiction).toBe('FR');
    expect(result.value.checksum).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(result.value.rules.size).toBe(2);
    expect(result.warnings).toHaveLength(0);
  });

  it('rejects invalid JSON', () => {
    const result = loadRulesPack('not json {{{');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('RULES.INVALID_JSON');
  });

  it('rejects a pack without source_ref', () => {
    const result = loadRulesPack(validPack({ source_ref: '' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('RULES.VALIDATION_ERROR');
  });

  it('rejects a rule without source_ref (D3.4)', () => {
    const pack = JSON.stringify({
      key: 'test',
      version: '1.0',
      jurisdiction: 'FR',
      effective_from: '2024-01-01',
      source_ref: 'Valid ref',
      rules: [{
        code: 'SOME_RULE',
        scope: {},
        params: {},
        source_ref: '',
      }],
    });
    const result = loadRulesPack(pack);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('RULES.VALIDATION_ERROR');
    expect(result.findings[0]?.params['path']).toContain('source_ref');
  });

  it('rejects a pack with missing key', () => {
    const raw = JSON.parse(validPack());
    delete raw.key;
    const result = loadRulesPack(JSON.stringify(raw));
    expect(result.ok).toBe(false);
  });

  it('accepts empty rules array (D3.4)', () => {
    const result = loadRulesPack(validPack({ rules: [] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rules.size).toBe(0);
  });

  it('accepts same code at different specificities (D3.5)', () => {
    const pack = JSON.stringify({
      key: 'test', version: '1.0', jurisdiction: 'FR',
      effective_from: '2024-01-01', source_ref: 'Ref',
      rules: [
        { code: 'R1', scope: {}, params: { v: 10 }, source_ref: 'A' },
        {
          code: 'R1',
          scope: { supportRegistry: 'wayfinding' },
          params: { v: 20 },
          source_ref: 'B',
        },
      ],
    });
    const result = loadRulesPack(pack);
    expect(result.ok).toBe(true);
  });

  it('rejects same code with an identical scope (D3.5)', () => {
    const pack = JSON.stringify({
      key: 'test', version: '1.0', jurisdiction: 'FR',
      effective_from: '2024-01-01', source_ref: 'Ref',
      rules: [
        {
          code: 'R1',
          scope: { context: 'interior' },
          params: {},
          source_ref: 'A',
        },
        {
          code: 'R1',
          scope: { context: 'interior' },
          params: {},
          source_ref: 'B',
        },
      ],
    });
    const result = loadRulesPack(pack);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('RULES.SCOPE_AMBIGUOUS');
  });

  it('resolves supportRegistry over context by specificity order (D3.5)', () => {
    const pack = JSON.stringify({
      key: 'test', version: '1.0', jurisdiction: 'FR',
      effective_from: '2024-01-01', source_ref: 'Ref',
      rules: [
        {
          code: 'R1',
          scope: { context: 'interior' },
          params: { v: 2 },
          source_ref: 'A',
        },
        {
          code: 'R1',
          scope: { supportRegistry: 'wayfinding' },
          params: { v: 4 },
          source_ref: 'B',
        },
      ],
    });
    const loaded = loadRulesPack(pack);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    // Both scopes match this context; supportRegistry (4) wins over context (2).
    const resolved = resolveRule(loaded.value, 'R1', {
      supportRegistry: 'wayfinding',
      context: 'interior',
    });
    expect(resolved.ok).toBe(true);
    if (resolved.ok) expect(resolved.value.params['v']).toBe(4);
  });

  it('produces stable checksums for identical content', () => {
    const json = validPack();
    const r1 = loadRulesPack(json);
    const r2 = loadRulesPack(json);
    expect(r1.ok && r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    expect(r1.value.checksum).toBe(r2.value.checksum);
  });
});
