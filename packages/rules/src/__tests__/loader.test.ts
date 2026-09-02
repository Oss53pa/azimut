import { describe, it, expect } from 'vitest';
import { loadRulesPack, resolveRule } from '../loader.js';

function validPack(overrides?: Record<string, unknown>) {
  return JSON.stringify({
    key: 'erp-france',
    version: '2024.1',
    jurisdiction: 'FR',
    effective_from: '2024-01-01',
    source_ref: 'Arrêté du 25 juin 1980, art. GN 8',
    rules: [
      {
        code: 'MIN_CHAR_HEIGHT_MM',
        scope: { supportRegistry: 'wayfinding' },
        params: { height_mm: 15 },
        source_ref: 'NF P98-405:2021, §5.2',
      },
      {
        code: 'MIN_CONTRAST_RATIO',
        scope: {},
        params: { ratio: 3 },
        source_ref: 'NF EN 16160:2024, §7.1',
      },
    ],
    ...overrides,
  });
}

describe('loadRulesPack', () => {
  it('loads a valid pack', () => {
    const result = loadRulesPack(validPack());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.key).toBe('erp-france');
    expect(result.value.version).toBe('2024.1');
    expect(result.value.jurisdiction).toBe('FR');
    expect(result.value.checksum).toMatch(/^[a-f0-9]{64}$/);
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

  it('rejects same code at same specificity (D3.5)', () => {
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
          scope: { supportRegistry: 'wayfinding' },
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

  it('produces stable checksums for identical content', () => {
    const json = validPack();
    const r1 = loadRulesPack(json);
    const r2 = loadRulesPack(json);
    expect(r1.ok && r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    expect(r1.value.checksum).toBe(r2.value.checksum);
  });
});

describe('resolveRule', () => {
  it('resolves an existing rule', () => {
    const loaded = loadRulesPack(validPack());
    if (!loaded.ok) throw new Error('pack should load');
    const result = resolveRule(loaded.value, 'MIN_CHAR_HEIGHT_MM', {
      supportRegistry: 'wayfinding',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.code).toBe('MIN_CHAR_HEIGHT_MM');
    expect(result.value.params).toEqual({ height_mm: 15 });
    expect(result.value.source_ref).toBe('NF P98-405:2021, §5.2');
  });

  it('returns error for absent rule (D3.4 no fallback)', () => {
    const loaded = loadRulesPack(validPack());
    if (!loaded.ok) throw new Error('pack should load');
    const result = resolveRule(loaded.value, 'NONEXISTENT_RULE');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('RULES.RULE_NOT_FOUND');
    expect(result.findings[0]?.severity).toBe('blocking');
  });

  it('picks the most specific matching scope (D3.5)', () => {
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
    const loaded = loadRulesPack(pack);
    if (!loaded.ok) throw new Error('pack should load');

    const broad = resolveRule(loaded.value, 'R1', {});
    expect(broad.ok).toBe(true);
    if (broad.ok) expect(broad.value.params['v']).toBe(10);

    const specific = resolveRule(loaded.value, 'R1', {
      supportRegistry: 'wayfinding',
    });
    expect(specific.ok).toBe(true);
    if (specific.ok) expect(specific.value.params['v']).toBe(20);
  });

  it('falls back to broader scope when specific does not match', () => {
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
    const loaded = loadRulesPack(pack);
    if (!loaded.ok) throw new Error('pack should load');

    const result = resolveRule(loaded.value, 'R1', {
      supportRegistry: 'safety',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.params['v']).toBe(10);
  });
});
