import { sha256Hex } from '@azimut/core-model';
import type { Outcome, Finding } from '@azimut/core-model';
import {
  manifestSchema,
  ruleFileSchema,
  type RulesPackRule,
} from './schema.js';
import type { LoadedRulesPack } from './loader.js';
import { groupAndCheckAmbiguity } from './loader.js';

export function loadPackDirectory(
  manifestJson: string,
  ruleFileContents: Readonly<Record<string, string>>,
): Outcome<LoadedRulesPack> {
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
        params: { path: issue.path.join('.'), message: issue.message },
        ruleRef: null,
      })),
    };
  }

  const manifest = manifestResult.data;

  const contentForChecksum = manifest.files
    .map((f) => ruleFileContents[f] ?? '')
    .join('');
  const computed = `sha256:${sha256Hex(contentForChecksum)}`;
  if (computed !== manifest.checksum) {
    return {
      ok: false,
      findings: [{
        code: 'RULES.PACK_CHECKSUM_MISMATCH',
        severity: 'blocking',
        entity: null,
        params: { expected: manifest.checksum, computed },
        ruleRef: null,
      }],
    };
  }

  const missingFiles: Finding[] = [];
  for (const fileName of manifest.files) {
    if (!(fileName in ruleFileContents)) {
      missingFiles.push({
        code: 'RULES.FILE_MISSING',
        severity: 'blocking',
        entity: null,
        params: { file: fileName },
        ruleRef: null,
      });
    }
  }
  if (missingFiles.length > 0) {
    return { ok: false, findings: missingFiles };
  }

  const extraFiles = Object.keys(ruleFileContents).filter(
    (f) => !manifest.files.includes(f),
  );
  if (extraFiles.length > 0) {
    return {
      ok: false,
      findings: extraFiles.map((f) => ({
        code: 'RULES.FILE_NOT_LISTED' as const,
        severity: 'blocking' as const,
        entity: null,
        params: { file: f },
        ruleRef: null,
      })),
    };
  }

  const allRules: RulesPackRule[] = [];
  for (const fileName of manifest.files) {
    const content = ruleFileContents[fileName];
    if (content === undefined) continue;

    let rawFile: unknown;
    try {
      rawFile = JSON.parse(content);
    } catch {
      return {
        ok: false,
        findings: [{
          code: 'RULES.INVALID_JSON',
          severity: 'blocking',
          entity: null,
          params: { file: fileName },
          ruleRef: null,
        }],
      };
    }

    const fileResult = ruleFileSchema.safeParse(rawFile);
    if (!fileResult.success) {
      return {
        ok: false,
        findings: fileResult.error.issues.map((issue) => ({
          code: 'RULES.VALIDATION_ERROR' as const,
          severity: 'blocking' as const,
          entity: null,
          params: {
            file: fileName,
            path: issue.path.join('.'),
            message: issue.message,
          },
          ruleRef: null,
        })),
      };
    }

    allRules.push(...fileResult.data);
  }

  const groupResult = groupAndCheckAmbiguity(allRules);
  if (!groupResult.ok) return groupResult;

  return {
    ok: true,
    value: {
      key: manifest.key,
      version: manifest.version,
      jurisdiction: manifest.jurisdiction,
      effective_from: manifest.effective_from,
      source_ref: manifest.checksum,
      checksum: computed,
      rules: groupResult.value,
    },
    warnings: [],
  };
}
