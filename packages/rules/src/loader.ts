import { createHash } from 'node:crypto';
import type { Outcome, Finding } from '@azimut/core-model';
import { rulesPackSchema, type RulesPackRule, type RuleScope } from './schema.js';

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

function computeChecksum(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function scopeSpecificity(scope: RuleScope): number {
  let n = 0;
  if (scope.supportRegistry !== undefined) n += 1;
  if (scope.context !== undefined) n += 1;
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
    const specs = group.map((r) => scopeSpecificity(r.scope));
    for (let i = 0; i < specs.length; i++) {
      for (let j = i + 1; j < specs.length; j++) {
        if (specs[i] === specs[j]) {
          ambiguous.push({
            code: 'RULES.SCOPE_AMBIGUOUS',
            severity: 'blocking',
            entity: null,
            params: { rule_code: code, specificity: specs[i] as number },
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

export function loadRulesPack(
  json: string,
): Outcome<LoadedRulesPack> {
  const checksum = computeChecksum(json);

  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return {
      ok: false,
      findings: [{
        code: 'RULES.INVALID_JSON',
        severity: 'blocking',
        entity: null,
        params: {},
        ruleRef: null,
      }],
    };
  }

  const result = rulesPackSchema.safeParse(raw);
  if (!result.success) {
    const findings: Finding[] = result.error.issues.map((issue) => ({
      code: 'RULES.VALIDATION_ERROR',
      severity: 'blocking' as const,
      entity: null,
      params: {
        path: issue.path.join('.'),
        message: issue.message,
      },
      ruleRef: null,
    }));
    return { ok: false, findings };
  }

  const pack = result.data;
  const groupResult = groupAndCheckAmbiguity(pack.rules);
  if (!groupResult.ok) return groupResult;

  return {
    ok: true,
    value: {
      key: pack.key,
      version: pack.version,
      jurisdiction: pack.jurisdiction,
      effective_from: pack.effective_from,
      source_ref: pack.source_ref,
      checksum,
      rules: groupResult.value,
    },
    warnings: [],
  };
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
