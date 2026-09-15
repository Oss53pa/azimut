import type { Outcome, Finding } from '@azimut/core-model';
import type { LoadedRulesPack } from './rule-resolution.js';

/**
 * The rules-pack corpus, keyed by the identifier a site binds to
 * (A5.8 `site_rules_binding.rules_pack_id`, folded onto `Site.rules_pack_id`).
 */
export type RulesPackIndex = ReadonlyMap<string, LoadedRulesPack>;

/** One corpus entry: the bound id and the directory that holds the pack. */
export type RulesPackSource = {
  /** The id a site binds to — matches `Site.rules_pack_id` / `rules_pack.id`. */
  readonly id: string;
  /** Directory under `rules-packs/` holding the manifest and rule files. */
  readonly directory: string;
};

function packNotBound(rulesPackId: string | null): Finding {
  return {
    code: 'RULES.PACK_NOT_BOUND',
    severity: 'blocking',
    entity: null,
    params: rulesPackId === null ? {} : { rules_pack_id: rulesPackId },
    ruleRef: null,
  };
}

/**
 * Resolve the pack a site is bound to (A5.8) into a loaded pack, given an index
 * of the corpus.
 *
 * The resolver is deliberately storage-agnostic. The index may be built from
 * the database (`rules_pack` / `rules_pack_rule`, the application's read-only
 * query surface) or straight from the file corpus (`rules-packs/`, checksum
 * verified). That choice belongs to the composition root, not here, so this
 * function never reads disk or database itself.
 *
 * A site with no binding, and a binding whose pack is absent from the corpus,
 * both yield `RULES.PACK_NOT_BOUND`: in either case no usable pack is available
 * for the site, and the product refuses to compose rather than invent one
 * (D3.4.3, D3.4.4).
 */
export function resolveSiteRulesPack(
  rulesPackId: string | null,
  index: RulesPackIndex,
): Outcome<LoadedRulesPack> {
  if (rulesPackId === null) {
    return { ok: false, findings: [packNotBound(null)] };
  }
  const pack = index.get(rulesPackId);
  if (pack === undefined) {
    return { ok: false, findings: [packNotBound(rulesPackId)] };
  }
  return { ok: true, value: pack, warnings: [] };
}
