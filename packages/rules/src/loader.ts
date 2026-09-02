import { createHash } from 'node:crypto';
import type { Outcome, Finding } from '@azimut/core-model';
import { rulesPackSchema, type RulesPackRule } from './schema.js';

export type LoadedRulesPack = {
  key: string;
  version: string;
  jurisdiction: string;
  effective_from: string;
  source_ref: string;
  checksum: string;
  rules: ReadonlyMap<string, RulesPackRule>;
};

function computeChecksum(content: string): string {
  return createHash('sha256').update(content).digest('hex');
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
      findings: [
        {
          code: 'RULES.INVALID_JSON',
          severity: 'blocking',
          entity: null,
          params: {},
          ruleRef: null,
        },
      ],
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
  const rulesMap = new Map<string, RulesPackRule>();
  const duplicates: Finding[] = [];

  for (const rule of pack.rules) {
    if (rulesMap.has(rule.code)) {
      duplicates.push({
        code: 'RULES.DUPLICATE_CODE',
        severity: 'blocking',
        entity: null,
        params: { rule_code: rule.code },
        ruleRef: null,
      });
    }
    rulesMap.set(rule.code, rule);
  }

  if (duplicates.length > 0) {
    return { ok: false, findings: duplicates };
  }

  return {
    ok: true,
    value: {
      key: pack.key,
      version: pack.version,
      jurisdiction: pack.jurisdiction,
      effective_from: pack.effective_from,
      source_ref: pack.source_ref,
      checksum,
      rules: rulesMap,
    },
    warnings: [],
  };
}

export function resolveRule(
  pack: LoadedRulesPack,
  code: string,
): Outcome<RulesPackRule> {
  const rule = pack.rules.get(code);
  if (rule === undefined) {
    return {
      ok: false,
      findings: [
        {
          code: 'RULES.RULE_NOT_FOUND',
          severity: 'blocking',
          entity: null,
          params: {
            rule_code: code,
            pack_key: pack.key,
            pack_version: pack.version,
          },
          ruleRef: null,
        },
      ],
    };
  }
  return { ok: true, value: rule, warnings: [] };
}
