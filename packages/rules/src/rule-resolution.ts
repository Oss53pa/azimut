/**
 * Résolution de règles — partie sans entrées-sorties.
 *
 * Séparée de `loader.ts` parce qu'elle doit rester utilisable dans un
 * navigateur. Le chargement d'un paquet lit le disque et calcule une
 * empreinte : c'est du Node, et cela n'a rien à faire dans un paquet
 * embarqué par le studio. La résolution, elle, est pure.
 *
 * Ce fichier ne doit jamais importer `node:`.
 */

import type { Outcome, Finding } from '@azimut/core-model';
import type { RulesPackRule, RuleScope } from './schema.js';

export type LoadedRulesPack = {
  key: string;
  version: string;
  jurisdiction: string;
  effective_from: string;
  source_ref: string;
  checksum: string;
  rules: ReadonlyMap<string, readonly RulesPackRule[]>;
};

export type RuleScopeContext = {
  readonly supportRegistry?: string;
  readonly context?: string;
  readonly sectorKey?: string;
};

/**
 * D3.5 — Scope specificity as a lexicographic priority, from strongest to
 * weakest: supportRegistry, then context, then sectorKey, then no scope.
 * Encoded as distinct bit weights so supportRegistry outranks any combination
 * of the lower dimensions (4 > 2 + 1). Because the weights are distinct powers
 * of two, two scopes share a specificity value only when they carry the exact
 * same set of dimensions — which is the "égalité stricte de spécificité" that
 * makes a load ambiguous.
 */
export function scopeSpecificity(scope: RuleScope): number {
  let n = 0;
  if (scope.supportRegistry !== undefined) n += 4;
  if (scope.context !== undefined) n += 2;
  if (scope.sectorKey !== undefined) n += 1;
  return n;
}

function scopeMatches(scope: RuleScope, ctx: RuleScopeContext): boolean {
  if (scope.supportRegistry !== undefined
    && scope.supportRegistry !== ctx.supportRegistry) return false;
  if (scope.context !== undefined
    && scope.context !== ctx.context) return false;
  if (scope.sectorKey !== undefined
    && scope.sectorKey !== ctx.sectorKey) return false;
  return true;
}

/**
 * Two scopes are ambiguous only when they are IDENTICAL — same dimensions AND
 * same values — because only then could a single context match both with equal
 * specificity. Two rules that share the dimension set but differ in value
 * (e.g. context interior vs exterior, or registry wayfinding vs safety)
 * partition the scope space and are never both selected for one context, so
 * they are not ambiguous (they are exactly the scope resolution the rules-pack
 * fixture exercises). This refines the earlier "same specificity" test, which
 * over-flagged such legitimate partitions.
 */
function scopesEqual(a: RuleScope, b: RuleScope): boolean {
  return (
    a.supportRegistry === b.supportRegistry &&
    a.context === b.context &&
    a.sectorKey === b.sectorKey
  );
}

export function groupAndCheckAmbiguity(
  rules: readonly RulesPackRule[],
): Outcome<ReadonlyMap<string, readonly RulesPackRule[]>> {
  const grouped = new Map<string, RulesPackRule[]>();
  for (const rule of rules) {
    let group = grouped.get(rule.code);
    if (!group) {
      group = [];
      grouped.set(rule.code, group);
    }
    group.push(rule);
  }

  const ambiguous: Finding[] = [];
  for (const [code, group] of grouped) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const scopeA = (group[i] as RulesPackRule).scope;
        const scopeB = (group[j] as RulesPackRule).scope;
        if (scopesEqual(scopeA, scopeB)) {
          ambiguous.push({
            code: 'RULES.SCOPE_AMBIGUOUS',
            severity: 'blocking',
            entity: null,
            params: { rule_code: code, specificity: scopeSpecificity(scopeA) },
            ruleRef: null,
          });
        }
      }
    }
  }

  if (ambiguous.length > 0) {
    return { ok: false, findings: ambiguous };
  }

  return { ok: true, value: grouped, warnings: [] };
}

export function resolveRule(
  pack: LoadedRulesPack,
  code: string,
  ctx: RuleScopeContext = {},
): Outcome<RulesPackRule> {
  const group = pack.rules.get(code);
  if (!group || group.length === 0) {
    return {
      ok: false,
      findings: [{
        code: 'RULES.RULE_NOT_FOUND',
        severity: 'blocking',
        entity: null,
        params: {
          rule_code: code,
          pack_key: pack.key,
          pack_version: pack.version,
        },
        ruleRef: null,
      }],
    };
  }

  const matching = group
    .filter((r) => scopeMatches(r.scope, ctx))
    .sort((a, b) => scopeSpecificity(b.scope) - scopeSpecificity(a.scope));

  if (matching.length === 0) {
    return {
      ok: false,
      findings: [{
        code: 'RULES.RULE_NOT_FOUND',
        severity: 'blocking',
        entity: null,
        params: {
          rule_code: code,
          pack_key: pack.key,
          pack_version: pack.version,
        },
        ruleRef: null,
      }],
    };
  }

  return { ok: true, value: matching[0] as RulesPackRule, warnings: [] };
}
