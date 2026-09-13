import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Outcome, Finding } from '@azimut/core-model';
import { rulesPackSchema, manifestSchema, type RulesPackRule, type RuleScope } from './schema.js';
import { loadPackDirectory } from './pack-directory.js';

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

export type LoadRulesPackOptions = {
  /** Runtime environment. A TEST-jurisdiction pack loads only when 'test'. */
  readonly environment?: string;
};

/**
 * Load a rules pack. With no `options`, `source` is a single-file JSON pack
 * string (legacy form). With `options`, `source` is a directory read from disk:
 * the manifest and its listed rule files are loaded, the TEST-jurisdiction
 * guard is applied, every rule must carry a documentary reference, and the
 * checksum is verified.
 */
export function loadRulesPack(
  source: string,
  options?: LoadRulesPackOptions,
): Outcome<LoadedRulesPack> {
  if (options !== undefined) {
    return loadRulesPackFromDirectory(source, options.environment ?? 'production');
  }
  const json = source;
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

/**
 * Garde-fou 3 — every rule must carry a non-empty documentary reference, so the
 * obligation posed by partie D is not bypassed. Checked before delegating so a
 * missing reference yields RULES.SOURCE_REF_MISSING rather than a generic schema
 * error.
 */
function checkSourceRefs(
  files: readonly string[],
  contents: Readonly<Record<string, string>>,
): Outcome<null> {
  const findings: Finding[] = [];
  for (const file of files) {
    const content = contents[file];
    if (content === undefined) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch {
      continue; // invalid JSON is reported by loadPackDirectory.
    }
    if (!Array.isArray(raw)) continue;
    for (const item of raw) {
      if (item === null || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const ref = rec['source_ref'];
      if (typeof ref !== 'string' || ref.trim() === '') {
        findings.push({
          code: 'RULES.SOURCE_REF_MISSING',
          severity: 'blocking',
          entity: null,
          params: {
            file,
            rule_code: typeof rec['code'] === 'string' ? (rec['code'] as string) : '',
          },
          ruleRef: null,
        });
      }
    }
  }
  if (findings.length > 0) return { ok: false, findings };
  return { ok: true, value: null, warnings: [] };
}

function readFileFinding(file: string): Finding {
  return {
    code: 'RULES.FILE_MISSING',
    severity: 'blocking',
    entity: null,
    params: { file },
    ruleRef: null,
  };
}

function loadRulesPackFromDirectory(
  dir: string,
  environment: string,
): Outcome<LoadedRulesPack> {
  let manifestJson: string;
  try {
    manifestJson = readFileSync(join(dir, 'manifest.json'), 'utf-8');
  } catch {
    return { ok: false, findings: [readFileFinding('manifest.json')] };
  }

  let rawManifest: unknown;
  try {
    rawManifest = JSON.parse(manifestJson);
  } catch {
    return {
      ok: false,
      findings: [{
        code: 'RULES.INVALID_JSON',
        severity: 'blocking',
        entity: null,
        params: { file: 'manifest.json' },
        ruleRef: null,
      }],
    };
  }

  const manifestResult = manifestSchema.safeParse(rawManifest);
  if (!manifestResult.success) {
    return {
      ok: false,
      findings: manifestResult.error.issues.map((issue) => ({
        code: 'RULES.VALIDATION_ERROR' as const,
        severity: 'blocking' as const,
        entity: null,
        params: { file: 'manifest.json', path: issue.path.join('.'), message: issue.message },
        ruleRef: null,
      })),
    };
  }
  const manifest = manifestResult.data;

  // Garde-fou 2 — a TEST-jurisdiction pack is refused outside a test environment.
  if (manifest.jurisdiction === 'TEST' && environment !== 'test') {
    return {
      ok: false,
      findings: [{
        code: 'RULES.TEST_PACK_OUTSIDE_TEST_ENV',
        severity: 'blocking',
        entity: null,
        params: { jurisdiction: manifest.jurisdiction, environment },
        ruleRef: null,
      }],
    };
  }

  const ruleFileContents: Record<string, string> = {};
  for (const file of manifest.files) {
    try {
      ruleFileContents[file] = readFileSync(join(dir, file), 'utf-8');
    } catch {
      return { ok: false, findings: [readFileFinding(file)] };
    }
  }

  const sourceRefCheck = checkSourceRefs(manifest.files, ruleFileContents);
  if (!sourceRefCheck.ok) return sourceRefCheck;

  return loadPackDirectory(manifestJson, ruleFileContents);
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
