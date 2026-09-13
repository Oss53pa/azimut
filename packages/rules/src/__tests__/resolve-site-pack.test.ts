import { describe, it, expect } from 'vitest';
import {
  resolveSiteRulesPack,
  buildRulesPackIndex,
  type RulesPackIndex,
} from '../resolve-site-pack.js';
import { loadRulesPack } from '../loader.js';

const FIXTURE = 'packages/testkit/fixtures/rules-packs/test-fixture';
const PACK_ID = 'rp-test-0001';

function fixtureIndex(): RulesPackIndex {
  const outcome = loadRulesPack(FIXTURE, { environment: 'test' });
  if (!outcome.ok) throw new Error('fixture non chargeable');
  return new Map([[PACK_ID, outcome.value]]);
}

describe('resolveSiteRulesPack', () => {
  it('resolves a bound id present in the index', () => {
    const index = fixtureIndex();
    const result = resolveSiteRulesPack(PACK_ID, index);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.jurisdiction).toBe('TEST');
      expect(result.warnings).toEqual([]);
    }
  });

  it('raises PACK_NOT_BOUND with no param when the site has no binding', () => {
    const result = resolveSiteRulesPack(null, fixtureIndex());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]?.code).toBe('RULES.PACK_NOT_BOUND');
      expect(result.findings[0]?.severity).toBe('blocking');
      expect(result.findings[0]?.params).toEqual({});
    }
  });

  it('raises PACK_NOT_BOUND naming the id when the pack is absent from the corpus', () => {
    const result = resolveSiteRulesPack('rp-unknown', fixtureIndex());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.findings[0]?.code).toBe('RULES.PACK_NOT_BOUND');
      expect(result.findings[0]?.params).toEqual({ rules_pack_id: 'rp-unknown' });
    }
  });

  it('does not read disk — an empty index simply misses', () => {
    const result = resolveSiteRulesPack(PACK_ID, new Map());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.findings[0]?.code).toBe('RULES.PACK_NOT_BOUND');
    }
  });
});

describe('buildRulesPackIndex', () => {
  it('builds an index from the file corpus and resolves through it', () => {
    const built = buildRulesPackIndex(
      [{ id: PACK_ID, directory: FIXTURE }],
      { environment: 'test' },
    );
    expect(built.ok).toBe(true);
    if (built.ok) {
      const resolved = resolveSiteRulesPack(PACK_ID, built.value);
      expect(resolved.ok).toBe(true);
      if (resolved.ok) expect(resolved.value.jurisdiction).toBe('TEST');
    }
  });

  it('applies the TEST-environment guard while loading (production refuses)', () => {
    const built = buildRulesPackIndex(
      [{ id: PACK_ID, directory: FIXTURE }],
      { environment: 'production' },
    );
    expect(built.ok).toBe(false);
    if (!built.ok) {
      expect(built.findings[0]?.code).toBe('RULES.TEST_PACK_OUTSIDE_TEST_ENV');
    }
  });

  it('aborts on the first pack that fails to load, not a partial index', () => {
    const built = buildRulesPackIndex(
      [
        { id: PACK_ID, directory: FIXTURE },
        { id: 'rp-tampered', directory: 'packages/testkit/fixtures/rules-packs/tampered' },
      ],
      { environment: 'test' },
    );
    expect(built.ok).toBe(false);
    if (!built.ok) {
      expect(built.findings[0]?.code).toBe('RULES.PACK_CHECKSUM_MISMATCH');
    }
  });

  it('produces an empty index from no sources', () => {
    const built = buildRulesPackIndex([], { environment: 'test' });
    expect(built.ok).toBe(true);
    if (built.ok) expect(built.value.size).toBe(0);
  });
});
