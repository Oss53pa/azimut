import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Outcome, Finding } from '@azimut/core-model';
import { rulesPackSchema, manifestSchema } from './schema.js';
import { loadPackDirectoryParsed } from './pack-directory.js';
import { groupAndCheckAmbiguity } from './rule-resolution.js';
import type { LoadedRulesPack } from './rule-resolution.js';

function computeChecksum(content: string): string {
  return createHash('sha256').update(content).digest('hex');
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

  // The manifest is already parsed and validated above — hand it over parsed so
  // it is not parsed and validated a second time.
  return loadPackDirectoryParsed(manifest, ruleFileContents);
}
