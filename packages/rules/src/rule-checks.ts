import { contrastRatio, type Finding, type Outcome } from '@azimut/core-model';
import type { LoadedRulesPack, RuleScopeContext } from './loader.js';
import { resolveRule } from './loader.js';
import type { RulesPackRule } from './schema.js';

/**
 * The quality-check engine. Each check RESOLVES its threshold from a loaded
 * rules pack (never a value written in code — INV-5), then compares a measured
 * value against it and raises the matching catalog anomaly. When the rule is
 * absent the resolution failure (RULES.RULE_NOT_FOUND) is propagated: the
 * product refuses rather than inventing a threshold.
 *
 * Measured inputs (character height, reading distance, colours) are supplied by
 * the caller — they are produced by the compose/render pipeline, not held on the
 * site graph.
 */

function numParam(rule: RulesPackRule, key: string): number | null {
  const value = rule.params[key];
  return typeof value === 'number' ? value : null;
}

function paramInvalid(rule: RulesPackRule, key: string): Finding {
  return {
    code: 'RULES.VALIDATION_ERROR',
    severity: 'blocking',
    entity: null,
    params: { rule_code: rule.code, param: key },
    ruleRef: null,
  };
}

const OK: Outcome<null> = { ok: true, value: null, warnings: [] };

export type CharHeightInput = {
  readonly supportRegistry: string;
  readonly context?: string;
  readonly reading_distance_m: number;
  readonly char_height_mm: number;
  readonly entity_id: string;
};

/**
 * Legibility — LEGIBILITY.MIN_CHAR_HEIGHT. The required height is the formula
 * `reading_distance_m * factor`, floored at `minimum_mm`. A measured height
 * below it raises LAYOUT.CHAR_HEIGHT_BELOW_MIN.
 */
export function checkCharHeight(
  pack: LoadedRulesPack,
  input: CharHeightInput,
): Outcome<null> {
  const scope: RuleScopeContext = input.context !== undefined
    ? { supportRegistry: input.supportRegistry, context: input.context }
    : { supportRegistry: input.supportRegistry };
  const resolved = resolveRule(pack, 'LEGIBILITY.MIN_CHAR_HEIGHT', scope);
  if (!resolved.ok) return resolved;

  const rule = resolved.value;
  const factor = numParam(rule, 'factor');
  if (factor === null) return { ok: false, findings: [paramInvalid(rule, 'factor')] };
  const floor = numParam(rule, 'minimum_mm') ?? 0;
  const required = Math.max(input.reading_distance_m * factor, floor);

  if (input.char_height_mm < required) {
    return {
      ok: false,
      findings: [{
        code: 'LAYOUT.CHAR_HEIGHT_BELOW_MIN',
        severity: 'blocking',
        entity: { kind: 'support_face', id: input.entity_id },
        params: {
          required_mm: required,
          actual_mm: input.char_height_mm,
          reading_distance_m: input.reading_distance_m,
        },
        ruleRef: rule.code,
      }],
    };
  }
  return OK;
}

export type ContrastInput = {
  readonly supportRegistry: string;
  /** Defaults to CONTRAST.MIN_TEXT_ON_BACKGROUND. */
  readonly code?: string;
  readonly foreground_hex: string;
  readonly background_hex: string;
  readonly entity_id: string;
};

/**
 * Contrast — CONTRAST.MIN_TEXT_ON_BACKGROUND (or the given code). Computes the
 * WCAG luminance-contrast ratio of the two display colours and, when it falls
 * below the resolved minimum, raises LAYOUT.CONTRAST_BELOW_MIN.
 */
export function checkContrast(
  pack: LoadedRulesPack,
  input: ContrastInput,
): Outcome<null> {
  const code = input.code ?? 'CONTRAST.MIN_TEXT_ON_BACKGROUND';
  const resolved = resolveRule(pack, code, { supportRegistry: input.supportRegistry });
  if (!resolved.ok) return resolved;

  const rule = resolved.value;
  const min = numParam(rule, 'min');
  if (min === null) return { ok: false, findings: [paramInvalid(rule, 'min')] };

  const ratio = contrastRatio(input.foreground_hex, input.background_hex);
  if (ratio === null) {
    return {
      ok: false,
      findings: [{
        code: 'RULES.VALIDATION_ERROR',
        severity: 'blocking',
        entity: { kind: 'support_face', id: input.entity_id },
        params: { reason: 'unparsable_colour' },
        ruleRef: rule.code,
      }],
    };
  }

  if (ratio < min) {
    return {
      ok: false,
      findings: [{
        code: 'LAYOUT.CONTRAST_BELOW_MIN',
        severity: 'blocking',
        entity: { kind: 'support_face', id: input.entity_id },
        params: { ratio, minimum: min },
        ruleRef: rule.code,
      }],
    };
  }
  return OK;
}
