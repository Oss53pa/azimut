import { describe, it, expect } from 'vitest';
import { sha256Hex } from '@azimut/core-model';
import { loadPackDirectory } from '../pack-directory.js';

function makeRuleFile(rules: unknown[]): string {
  return JSON.stringify(rules);
}

function makeManifest(
  files: Record<string, string>,
  overrides?: Record<string, unknown>,
) {
  const fileNames = Object.keys(files);
  const content = fileNames.map((f) => files[f]).join('');
  const checksum = `sha256:${sha256Hex(content)}`;
  return JSON.stringify({
    key: 'international',
    version: '2026.1',
    jurisdiction: 'INTL',
    effective_from: '2026-01-01',
    supersedes: null,
    files: fileNames,
    checksum,
    ...overrides,
  });
}

const legibilityRules = makeRuleFile([
  {
    code: 'LEGIBILITY.MIN_CHAR_HEIGHT',
    scope: { supportRegistry: 'wayfinding', context: 'interior' },
    kind: 'formula',
    params: { expression: 'readingDistance_m * factor', factor: 5, minimum_mm: 20 },
    source_ref: 'NF P98-405:2021, §5.2',
    notes: '',
  },
]);

const contrastRules = makeRuleFile([
  {
    code: 'CONTRAST.MIN_RATIO',
    scope: {},
    params: { ratio: 3 },
    source_ref: 'NF EN 16160:2024, §7.1',
  },
]);

describe('D3.1 — loadPackDirectory', () => {
  it('loads a valid multi-file pack', () => {
    const files = { 'legibility.json': legibilityRules, 'contrast.json': contrastRules };
    const manifest = makeManifest(files);
    const result = loadPackDirectory(manifest, files);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.key).toBe('international');
    expect(result.value.version).toBe('2026.1');
    expect(result.value.rules.size).toBe(2);
  });

  it('rejects invalid manifest JSON', () => {
    const result = loadPackDirectory('not json', {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('RULES.INVALID_JSON');
  });

  it('rejects manifest missing key', () => {
    const files = { 'rules.json': makeRuleFile([]) };
    const manifest = makeManifest(files, { key: '' });
    const result = loadPackDirectory(manifest, files);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('RULES.VALIDATION_ERROR');
  });

  it('rejects checksum mismatch (D3.4)', () => {
    const files = { 'rules.json': legibilityRules };
    const manifest = makeManifest(files, { checksum: 'sha256:0000' });
    const result = loadPackDirectory(manifest, files);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('RULES.PACK_CHECKSUM_MISMATCH');
  });

  it('rejects when a listed file is missing', () => {
    const files = { 'legibility.json': legibilityRules };
    const checksum = `sha256:${sha256Hex(legibilityRules + '')}`;
    const manifest = JSON.stringify({
      key: 'test', version: '1.0', jurisdiction: 'FR',
      effective_from: '2026-01-01', files: ['legibility.json', 'missing.json'],
      checksum,
    });
    const result = loadPackDirectory(manifest, files);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.some((f) => f.code === 'RULES.FILE_MISSING')).toBe(true);
  });

  it('rejects extra files not in manifest', () => {
    const files = {
      'legibility.json': legibilityRules,
      'extra.json': makeRuleFile([]),
    };
    const manifest = makeManifest({ 'legibility.json': legibilityRules });
    const result = loadPackDirectory(manifest, files);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('RULES.FILE_NOT_LISTED');
  });

  it('rejects invalid JSON in a rule file', () => {
    const files = { 'bad.json': 'not json' };
    const manifest = makeManifest(files);
    const result = loadPackDirectory(manifest, files);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('RULES.INVALID_JSON');
  });

  it('rejects a rule without source_ref (D3.4)', () => {
    const badRules = makeRuleFile([
      { code: 'X', scope: {}, params: {}, source_ref: '' },
    ]);
    const files = { 'rules.json': badRules };
    const manifest = makeManifest(files);
    const result = loadPackDirectory(manifest, files);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('RULES.VALIDATION_ERROR');
  });

  it('accepts an empty pack (D3.4)', () => {
    const files = { 'empty.json': makeRuleFile([]) };
    const manifest = makeManifest(files);
    const result = loadPackDirectory(manifest, files);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rules.size).toBe(0);
  });

  it('detects scope ambiguity across files', () => {
    const file1 = makeRuleFile([
      { code: 'R1', scope: {}, params: { v: 1 }, source_ref: 'A' },
    ]);
    const file2 = makeRuleFile([
      { code: 'R1', scope: {}, params: { v: 2 }, source_ref: 'B' },
    ]);
    const files = { 'a.json': file1, 'b.json': file2 };
    const manifest = makeManifest(files);
    const result = loadPackDirectory(manifest, files);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('RULES.SCOPE_AMBIGUOUS');
  });

  it('preserves rule kind and notes fields (D3.3)', () => {
    const rules = makeRuleFile([{
      code: 'LEGIBILITY.MIN_CHAR_HEIGHT',
      scope: {},
      kind: 'formula',
      params: { factor: 5 },
      source_ref: 'NF P98-405:2021',
      notes: 'Based on reading distance formula',
    }]);
    const files = { 'rules.json': rules };
    const manifest = makeManifest(files);
    const result = loadPackDirectory(manifest, files);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const loaded = result.value.rules.get('LEGIBILITY.MIN_CHAR_HEIGHT');
    expect(loaded).toHaveLength(1);
    const rule = loaded?.[0];
    expect(rule?.kind).toBe('formula');
    expect(rule?.notes).toBe('Based on reading distance formula');
  });
});
