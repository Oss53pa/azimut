import { describe, it, expect } from 'vitest';
import {
  resolveSiteRulesPack,
  type RulesPackIndex,
} from '../resolve-site-pack.js';
import { loadRulesPack } from '../loader.js';
import { buildRulesPackIndex } from '../pack-index.js';
import type { SiteRulesBinding } from '@azimut/core-model';

const FIXTURE = 'packages/testkit/fixtures/rules-packs/test-fixture';
const PACK_ID = 'rp-test-0001';

/** Le site rattaché à un seul paquet, en socle. */
function socle(id: string): readonly SiteRulesBinding[] {
  return [{ id: 'rb-socle', rules_pack_id: id, role: 'base' }];
}

function fixtureIndex(): RulesPackIndex {
  const outcome = loadRulesPack(FIXTURE, { environment: 'test' });
  if (!outcome.ok) throw new Error('fixture non chargeable');
  return new Map([[PACK_ID, outcome.value]]);
}

describe('resolveSiteRulesPack', () => {
  it('resolves a bound id present in the index', () => {
    const index = fixtureIndex();
    const result = resolveSiteRulesPack(socle(PACK_ID), index);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.jurisdiction).toBe('TEST');
      expect(result.warnings).toEqual([]);
    }
  });

  it('raises PACK_NOT_BOUND with no param when the site has no binding', () => {
    const result = resolveSiteRulesPack([], fixtureIndex());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]?.code).toBe('RULES.PACK_NOT_BOUND');
      expect(result.findings[0]?.severity).toBe('blocking');
      expect(result.findings[0]?.params).toEqual({});
    }
  });

  it('raises PACK_NOT_BOUND naming the id when the pack is absent from the corpus', () => {
    const result = resolveSiteRulesPack(socle('rp-unknown'), fixtureIndex());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.findings[0]?.code).toBe('RULES.PACK_NOT_BOUND');
      expect(result.findings[0]?.params).toEqual({ rules_pack_id: 'rp-unknown' });
    }
  });

  it('does not read disk — an empty index simply misses', () => {
    const result = resolveSiteRulesPack(socle(PACK_ID), new Map());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.findings[0]?.code).toBe('RULES.PACK_NOT_BOUND');
    }
  });
});

describe('resolveSiteRulesPack — socle et surcouche, A5.8 et D3.6', () => {
  const OVERLAY_ID = 'rp-test-overlay';
  const index = (): RulesPackIndex => {
    const pack = fixtureIndex().get(PACK_ID);
    if (pack === undefined) throw new Error('fixture non chargeable');
    return new Map([[PACK_ID, pack], [OVERLAY_ID, { ...pack, key: 'overlay', jurisdiction: 'TEST-PAYS' }]]);
  };

  it('fusionne le socle et la surcouche, qui l’emporte', () => {
    const result = resolveSiteRulesPack([
      { id: 'rb-1', rules_pack_id: PACK_ID, role: 'base' },
      { id: 'rb-2', rules_pack_id: OVERLAY_ID, role: 'overlay' },
    ], index());
    expect(result.ok).toBe(true);
    // D3.6 : la juridiction effective est celle de la surcouche une fois
    // appliquée.
    if (result.ok) expect(result.value.jurisdiction).toBe('TEST-PAYS');
  });

  it('prend la surcouche seule quand le site n’a pas de socle', () => {
    const result = resolveSiteRulesPack(
      [{ id: 'rb-2', rules_pack_id: OVERLAY_ID, role: 'overlay' }], index(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.key).toBe('overlay');
  });

  it('refuse quand l’un des deux paquets manque au corpus, et le nomme', () => {
    const result = resolveSiteRulesPack([
      { id: 'rb-1', rules_pack_id: PACK_ID, role: 'base' },
      { id: 'rb-2', rules_pack_id: 'rp-absent', role: 'overlay' },
    ], index());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.findings.map(f => [f.code, f.params])).toEqual([
        ['RULES.PACK_NOT_BOUND', { rules_pack_id: 'rp-absent' }],
      ]);
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
      const resolved = resolveSiteRulesPack(socle(PACK_ID), built.value);
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
