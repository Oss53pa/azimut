import { describe, it, expect } from 'vitest';
import type { SiteRulesBinding } from '@azimut/core-model';
import { boundRulesPackIdentities, resolveSiteRulesPack, type RulesPackIndex } from '../resolve-site-pack.js';
import { loadRulesPack } from '../loader.js';

/**
 * D7.1 — les paquets d'un site, tels que l'empreinte de contenu les porte.
 *
 * Les deux rattachements, chacun avec sa clé et sa version, et non l'identité
 * du paquet fusionné, qui garde celle du socle.
 */

const FIXTURE = 'packages/testkit/fixtures/rules-packs/test-fixture';
const SOCLE_ID = 'rp-test-0001';
const PAYS_ID = 'rp-test-pays';

function index(): RulesPackIndex {
  const loaded = loadRulesPack(FIXTURE, { environment: 'test' });
  if (!loaded.ok) throw new Error('fixture non chargeable');
  return new Map([
    [SOCLE_ID, loaded.value],
    [PAYS_ID, { ...loaded.value, key: 'test-pays', version: '9.9' }],
  ]);
}

const socle: SiteRulesBinding = { id: 'rb-1', rules_pack_id: SOCLE_ID, role: 'base' };
const pays: SiteRulesBinding = { id: 'rb-2', rules_pack_id: PAYS_ID, role: 'overlay' };

describe('D7.1 — boundRulesPackIdentities', () => {
  it('rend le socle et la surcouche, chacun avec sa clé et sa version', () => {
    const packs = index();
    const socleKey = packs.get(SOCLE_ID);
    const result = boundRulesPackIdentities([pays, socle], packs);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        base: { key: socleKey?.key, version: socleKey?.version },
        overlay: { key: 'test-pays', version: '9.9' },
      });
    }
  });

  it('garde la surcouche que l’identité du paquet fusionné perdrait', () => {
    const merged = resolveSiteRulesPack([socle, pays], index());
    const identities = boundRulesPackIdentities([socle, pays], index());
    expect(merged.ok && identities.ok).toBe(true);
    if (merged.ok && identities.ok) {
      expect(merged.value.key).toBe(identities.value.base?.key);
      expect(identities.value.overlay?.key).toBe('test-pays');
    }
  });

  it('rend une surcouche seule, sans socle', () => {
    const result = boundRulesPackIdentities([pays], index());
    expect(result.ok && result.value).toEqual({ overlay: { key: 'test-pays', version: '9.9' } });
  });

  it('refuse un site sans paquet : annexe T, §8, pas d’empreinte', () => {
    const result = boundRulesPackIdentities([], index());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.findings.map(f => f.code)).toEqual(['RULES.PACK_NOT_BOUND']);
  });

  it('refuse un paquet rattaché absent du corpus, et le nomme', () => {
    const result = boundRulesPackIdentities(
      [socle, { ...pays, rules_pack_id: 'rp-absent' }], index(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.findings[0]?.params).toEqual({ rules_pack_id: 'rp-absent' });
  });
});
