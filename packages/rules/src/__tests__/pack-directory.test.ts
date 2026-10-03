import { describe, it, expect } from 'vitest';
import { sha256Hex } from '@azimut/core-model';
import { loadPackDirectory } from '../pack-directory.js';
import { computeRulesPackChecksum } from '../pack-empreinte.js';

/**
 * L'empreinte d'un paquet, calculée par la fonction du produit (D7.2). Un
 * fichier illisible n'en a pas : la valeur rendue alors n'est jamais comparée,
 * le chargeur refusant le fichier avant l'empreinte.
 */
function checksumOf(key: string, files: readonly string[], contents: Record<string, string>): string {
  const checksum = computeRulesPackChecksum(key, files, contents);
  return checksum.ok ? checksum.value : 'sha256:illisible';
}

function makeRuleFile(rules: unknown[]): string {
  return JSON.stringify(rules);
}

function makeManifest(
  files: Record<string, string>,
  overrides?: Record<string, unknown>,
) {
  const fileNames = Object.keys(files);
  const checksum = checksumOf('international', fileNames, files);
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
    const checksum = checksumOf('test', ['legibility.json'], files);
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

  it('rejects manifest missing version', () => {
    const files = { 'rules.json': makeRuleFile([]) };
    const manifest = makeManifest(files, { version: '' });
    const result = loadPackDirectory(manifest, files);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('RULES.VALIDATION_ERROR');
  });

  it('rejects non-array rule file content', () => {
    const files = { 'rules.json': JSON.stringify({ not: 'array' }) };
    const manifest = makeManifest(files);
    const result = loadPackDirectory(manifest, files);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('RULES.VALIDATION_ERROR');
  });

  it('reports multiple missing files', () => {
    const checksum = checksumOf('test', [], {});
    const manifest = JSON.stringify({
      key: 'test', version: '1.0', jurisdiction: 'FR',
      effective_from: '2026-01-01',
      files: ['a.json', 'b.json'],
      checksum,
    });
    const result = loadPackDirectory(manifest, {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.length).toBe(2);
    expect(result.findings.every((f) => f.code === 'RULES.FILE_MISSING')).toBe(true);
  });

  it('reports multiple extra files', () => {
    const files = {
      'legibility.json': legibilityRules,
      'extra1.json': makeRuleFile([]),
      'extra2.json': makeRuleFile([]),
    };
    const manifest = makeManifest({ 'legibility.json': legibilityRules });
    const result = loadPackDirectory(manifest, files);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const extras = result.findings.filter((f) => f.code === 'RULES.FILE_NOT_LISTED');
    expect(extras.length).toBe(2);
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

describe('D7.2 — l’empreinte d’un paquet suit la forme canonique commune', () => {
  it('ne dépend ni des espaces ni de l’ordre des clés d’un fichier', () => {
    const compact = { 'rules.json': JSON.stringify([{ a: 1, b: 'é' }]) };
    const spaced = { 'rules.json': '[ { "b": "é", "a": 1 } ]' };
    expect(checksumOf('k', ['rules.json'], spaced)).toBe(checksumOf('k', ['rules.json'], compact));
  });

  it('change avec le nom d’un fichier ou l’ordre des fichiers', () => {
    const a = JSON.stringify([{ x: 1 }]);
    const b = JSON.stringify([{ y: 2 }]);
    const base = checksumOf('k', ['a.json', 'b.json'], { 'a.json': a, 'b.json': b });
    expect(checksumOf('k', ['b.json', 'a.json'], { 'a.json': a, 'b.json': b })).not.toBe(base);
    expect(checksumOf('k', ['a2.json', 'b.json'], { 'a2.json': a, 'b.json': b })).not.toBe(base);
  });

  it('un manifeste écrit sous l’ancienne forme n’est pas converti : son paquet est refusé', () => {
    const files = { 'rules.json': legibilityRules };
    // L'ancienne forme : le condensé des octets des fichiers mis bout à bout.
    const former = `sha256:${sha256Hex(legibilityRules)}`;
    const manifest = makeManifest(files, { checksum: former });
    const result = loadPackDirectory(manifest, files);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('RULES.PACK_CHECKSUM_MISMATCH');
  });
});
