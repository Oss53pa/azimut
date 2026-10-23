import type { Outcome, Finding } from '@azimut/core-model';
import type { RulesPackRule, RuleScope, RuleConstraint } from './schema.js';
import { groupAndCheckAmbiguity, type LoadedRulesPack } from './rule-resolution.js';

/**
 * D3.6: Country overlay. A site may bind a base (international) pack and a
 * country pack. A country rule takes precedence **only if it is at least as
 * constraining** as the base rule it overrides; a less-constraining country
 * rule is rejected at load with RULES.OVERLAY_LESS_RESTRICTIVE. The overlay
 * hardens, never loosens.
 *
 * A country rule whose direction of constraint cannot be established (no
 * `constraint` declared, or the compared param is missing / of the wrong
 * type) cannot be proven more constraining: the base rule is kept and a
 * RULES.OVERLAY_NOT_COMPARABLE warning is emitted rather than silently
 * dropping or blindly applying the country rule.
 *
 * A country rule that matches no base rule (same code AND same scope) is
 * additive and is layered in as-is.
 */

type OverlayComparison = 'tighter-or-equal' | 'looser' | 'incomparable';

function scopeKey(scope: RuleScope): string {
  return [
    scope.supportRegistry ?? '',
    scope.context ?? '',
    scope.sectorKey ?? '',
  ].join('|');
}

function ruleKey(rule: RulesPackRule): string {
  return `${rule.code}\u0000${scopeKey(rule.scope)}`;
}

/**
 * Whether `overlayVal` is at least as constraining as `baseVal` under the
 * declared direction. Returns null when the values are not comparable for the
 * chosen direction (type mismatch).
 */
function atLeastAsConstraining(
  overlayVal: string | number | boolean,
  baseVal: string | number | boolean,
  tighten: RuleConstraint['tighten'],
): boolean | null {
  switch (tighten) {
    case 'higher':
      if (typeof overlayVal === 'number' && typeof baseVal === 'number') {
        return overlayVal >= baseVal;
      }
      return null;
    case 'lower':
      if (typeof overlayVal === 'number' && typeof baseVal === 'number') {
        return overlayVal <= baseVal;
      }
      return null;
    case 'boolean-true':
      if (typeof overlayVal === 'boolean' && typeof baseVal === 'boolean') {
        return (overlayVal ? 1 : 0) >= (baseVal ? 1 : 0);
      }
      return null;
    case 'boolean-false':
      if (typeof overlayVal === 'boolean' && typeof baseVal === 'boolean') {
        return (overlayVal ? 0 : 1) >= (baseVal ? 0 : 1);
      }
      return null;
  }
}

function compareOverlay(
  country: RulesPackRule,
  base: RulesPackRule,
): OverlayComparison {
  const c = country.constraint;
  if (!c) return 'incomparable';
  const overlayVal = country.params[c.key];
  const baseVal = base.params[c.key];
  if (overlayVal === undefined || baseVal === undefined) return 'incomparable';
  const result = atLeastAsConstraining(overlayVal, baseVal, c.tighten);
  if (result === null) return 'incomparable';
  return result ? 'tighter-or-equal' : 'looser';
}

export function mergeCountryOverlay(
  base: LoadedRulesPack,
  overlay: LoadedRulesPack,
): Outcome<LoadedRulesPack> {
  // Flatten the base rules, keyed by code + exact scope, preserving order.
  const merged = new Map<string, RulesPackRule>();
  for (const [, group] of base.rules) {
    for (const rule of group) merged.set(ruleKey(rule), rule);
  }

  const blocking: Finding[] = [];
  const warnings: Finding[] = [];

  for (const [, group] of overlay.rules) {
    for (const country of group) {
      const key = ruleKey(country);
      const baseRule = merged.get(key);

      if (!baseRule) {
        merged.set(key, country); // additive country rule
        continue;
      }

      const cmp = compareOverlay(country, baseRule);
      if (cmp === 'tighter-or-equal') {
        merged.set(key, country); // country hardens the base rule
      } else if (cmp === 'looser') {
        blocking.push({
          code: 'RULES.OVERLAY_LESS_RESTRICTIVE',
          severity: 'blocking',
          entity: null,
          params: {
            rule_code: country.code,
            base_key: base.key,
            overlay_key: overlay.key,
          },
          ruleRef: null,
        });
      } else {
        warnings.push({
          code: 'RULES.OVERLAY_NOT_COMPARABLE',
          severity: 'warning',
          entity: null,
          params: {
            rule_code: country.code,
            base_key: base.key,
            overlay_key: overlay.key,
          },
          ruleRef: null,
        });
      }
    }
  }

  if (blocking.length > 0) return { ok: false, findings: blocking };

  const grouped = groupAndCheckAmbiguity([...merged.values()]);
  if (!grouped.ok) return grouped;

  return {
    ok: true,
    value: {
      key: base.key,
      version: base.version,
      // The effective jurisdiction is the country's once the overlay applies.
      jurisdiction: overlay.jurisdiction,
      effective_from: base.effective_from,
      source_ref: base.source_ref,
      checksum: base.checksum,
      rules: grouped.value,
    },
    warnings,
  };
}
