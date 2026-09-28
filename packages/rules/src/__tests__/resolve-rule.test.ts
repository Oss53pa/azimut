import { describe, it, expect } from 'vitest';
import { loadRulesPack } from '../loader.js';
import {
  resolveRule,
} from '../rule-resolution.js';
import { validPack } from './loader-fixtures.js';

// Suite de loader.test.ts : résolution d'une règle.
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

  it('returns RULE_NOT_FOUND when no scope matches (line 163)', () => {
    const pack = JSON.stringify({
      key: 'test', version: '1.0', jurisdiction: 'FR',
      effective_from: '2024-01-01', source_ref: 'Ref',
      rules: [
        {
          code: 'R1',
          scope: { supportRegistry: 'wayfinding' },
          params: { v: 10 },
          source_ref: 'A',
        },
      ],
    });
    const loaded = loadRulesPack(pack);
    if (!loaded.ok) throw new Error('pack should load');
    const result = resolveRule(loaded.value, 'R1', {
      supportRegistry: 'safety',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('RULES.RULE_NOT_FOUND');
  });

  it('matches by context scope field', () => {
    const pack = JSON.stringify({
      key: 'test', version: '1.0', jurisdiction: 'FR',
      effective_from: '2024-01-01', source_ref: 'Ref',
      rules: [
        {
          code: 'R1',
          scope: { context: 'indoor' },
          params: { v: 30 },
          source_ref: 'C',
        },
      ],
    });
    const loaded = loadRulesPack(pack);
    if (!loaded.ok) throw new Error('pack should load');
    const hit = resolveRule(loaded.value, 'R1', { context: 'indoor' });
    expect(hit.ok).toBe(true);
    const miss = resolveRule(loaded.value, 'R1', { context: 'outdoor' });
    expect(miss.ok).toBe(false);
  });

  it('matches by sectorKey scope field', () => {
    const pack = JSON.stringify({
      key: 'test', version: '1.0', jurisdiction: 'FR',
      effective_from: '2024-01-01', source_ref: 'Ref',
      rules: [
        {
          code: 'R1',
          scope: { sectorKey: 'health' },
          params: { v: 40 },
          source_ref: 'D',
        },
      ],
    });
    const loaded = loadRulesPack(pack);
    if (!loaded.ok) throw new Error('pack should load');
    const hit = resolveRule(loaded.value, 'R1', { sectorKey: 'health' });
    expect(hit.ok).toBe(true);
    const miss = resolveRule(loaded.value, 'R1', { sectorKey: 'retail' });
    expect(miss.ok).toBe(false);
  });

  it('requires all scope fields to match (multi-field)', () => {
    const pack = JSON.stringify({ key: 'test', version: '1.0', jurisdiction: 'FR', effective_from: '2024-01-01', source_ref: 'Ref',
      rules: [{ code: 'R1', scope: { supportRegistry: 'wayfinding', context: 'indoor' }, params: { v: 50 }, source_ref: 'E' }] });
    const loaded = loadRulesPack(pack);
    if (!loaded.ok) throw new Error('pack should load');
    const hit = resolveRule(loaded.value, 'R1', { supportRegistry: 'wayfinding', context: 'indoor' });
    expect(hit.ok).toBe(true);
    const miss2 = resolveRule(loaded.value, 'R1', { supportRegistry: 'wayfinding', context: 'outdoor' });
    expect(miss2.ok).toBe(false);
  });
});
