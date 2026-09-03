import { describe, it, expect } from 'vitest';
import {
  ruleScopeSchema,
  rulesPackRuleSchema,
  rulesPackSchema,
  manifestSchema,
  ruleFileSchema,
} from '../schema.js';

describe('ruleScopeSchema', () => {
  it('accepts empty object', () => {
    const result = ruleScopeSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts full scope', () => {
    const result = ruleScopeSchema.safeParse({
      supportRegistry: 'safety',
      context: 'interior',
      sectorKey: 'hospital',
    });
    expect(result.success).toBe(true);
  });

  it('defaults to empty object when undefined', () => {
    const result = ruleScopeSchema.safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({});
    }
  });
});

describe('rulesPackRuleSchema', () => {
  const validRule = {
    code: 'CHAR_HEIGHT_MIN',
    scope: {},
    params: { min_mm: 15 },
    source_ref: 'ISO-21542:2011 §6.3',
  };

  it('accepts valid rule', () => {
    const result = rulesPackRuleSchema.safeParse(validRule);
    expect(result.success).toBe(true);
  });

  it('rejects empty code', () => {
    const result = rulesPackRuleSchema.safeParse({ ...validRule, code: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing source_ref', () => {
    const { source_ref: _src, ...noRef } = validRule;
    void _src;
    const result = rulesPackRuleSchema.safeParse(noRef);
    expect(result.success).toBe(false);
  });

  it('accepts string, number, boolean params', () => {
    const rule = {
      ...validRule,
      params: { min_mm: 15, label: 'test', enabled: true },
    };
    const result = rulesPackRuleSchema.safeParse(rule);
    expect(result.success).toBe(true);
  });

  it('accepts optional kind', () => {
    const rule = { ...validRule, kind: 'char_height' };
    const result = rulesPackRuleSchema.safeParse(rule);
    expect(result.success).toBe(true);
  });

  it('accepts optional notes', () => {
    const rule = { ...validRule, notes: 'some note' };
    const result = rulesPackRuleSchema.safeParse(rule);
    expect(result.success).toBe(true);
  });
});

describe('rulesPackSchema', () => {
  const validPack = {
    key: 'iso-21542',
    version: '1.0.0',
    jurisdiction: 'international',
    effective_from: '2011-12-15',
    source_ref: 'ISO-21542:2011',
    rules: [
      {
        code: 'CHAR_HEIGHT_MIN',
        scope: {},
        params: { min_mm: 15 },
        source_ref: 'ISO-21542:2011 §6.3',
      },
    ],
  };

  it('accepts valid pack', () => {
    const result = rulesPackSchema.safeParse(validPack);
    expect(result.success).toBe(true);
  });

  it('rejects missing key', () => {
    const { key: _key, ...noKey } = validPack;
    void _key;
    const result = rulesPackSchema.safeParse(noKey);
    expect(result.success).toBe(false);
  });

  it('accepts empty rules array', () => {
    const result = rulesPackSchema.safeParse({ ...validPack, rules: [] });
    expect(result.success).toBe(true);
  });
});

describe('manifestSchema', () => {
  const validManifest = {
    key: 'iso-21542',
    version: '1.0.0',
    jurisdiction: 'international',
    effective_from: '2011-12-15',
    files: ['char-height.json', 'contrast.json'],
    checksum: 'abc123',
  };

  it('accepts valid manifest', () => {
    const result = manifestSchema.safeParse(validManifest);
    expect(result.success).toBe(true);
  });

  it('accepts null supersedes', () => {
    const result = manifestSchema.safeParse({ ...validManifest, supersedes: null });
    expect(result.success).toBe(true);
  });

  it('accepts string supersedes', () => {
    const result = manifestSchema.safeParse({ ...validManifest, supersedes: 'v0.9.0' });
    expect(result.success).toBe(true);
  });

  it('accepts empty files array', () => {
    const result = manifestSchema.safeParse({ ...validManifest, files: [] });
    expect(result.success).toBe(true);
  });

  it('rejects missing checksum', () => {
    const { checksum: _chk, ...noChecksum } = validManifest;
    void _chk;
    const result = manifestSchema.safeParse(noChecksum);
    expect(result.success).toBe(false);
  });
});

describe('ruleFileSchema', () => {
  it('accepts array of rules', () => {
    const rules = [
      {
        code: 'CONTRAST_MIN',
        scope: {},
        params: { ratio: 4.5 },
        source_ref: 'WCAG 2.1 §1.4.3',
      },
    ];
    const result = ruleFileSchema.safeParse(rules);
    expect(result.success).toBe(true);
  });

  it('accepts empty array', () => {
    const result = ruleFileSchema.safeParse([]);
    expect(result.success).toBe(true);
  });

  it('rejects non-array', () => {
    const result = ruleFileSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
