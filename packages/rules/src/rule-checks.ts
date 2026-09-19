import {
  contrastRatio, roundHalfAwayFromZero, type Finding, type Outcome,
} from '@azimut/core-model';
import type { LoadedRulesPack, RuleScopeContext } from './rule-resolution.js';
import { resolveRule } from './rule-resolution.js';
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
type ResolvedCharHeight = {
  readonly required_mm: number;
  readonly rule_code: string;
};

/** Résout la règle et applique sa formule. Un seul endroit la porte. */
function resolveCharHeight(
  pack: LoadedRulesPack,
  input: CharHeightInput,
): Outcome<ResolvedCharHeight> {
  const scope: RuleScopeContext = input.context !== undefined
    ? { supportRegistry: input.supportRegistry, context: input.context }
    : { supportRegistry: input.supportRegistry };
  const resolved = resolveRule(pack, 'LEGIBILITY.MIN_CHAR_HEIGHT', scope);
  if (!resolved.ok) return resolved;

  const rule = resolved.value;
  const factor = numParam(rule, 'factor');
  if (factor === null) return { ok: false, findings: [paramInvalid(rule, 'factor')] };
  const floor = numParam(rule, 'minimum_mm') ?? 0;
  return {
    ok: true,
    value: {
      required_mm: Math.max(input.reading_distance_m * factor, floor),
      rule_code: rule.code,
    },
    warnings: [],
  };
}

/**
 * G3 / G4 — la hauteur de caractère exigée à cette distance de lecture, en
 * millimètres, telle que le paquet de règles la définit.
 *
 * Le calcul du format l'emploie sans recopier la formule : le seuil qui refuse
 * et la dimension qui se calcule viennent de la même règle et du même paquet
 * (invariant 1, G4).
 */
export function requiredCharHeightMm(
  pack: LoadedRulesPack,
  input: CharHeightInput,
): Outcome<number> {
  const resolved = resolveCharHeight(pack, input);
  if (!resolved.ok) return resolved;
  return { ok: true, value: resolved.value.required_mm, warnings: [] };
}

export function checkCharHeight(
  pack: LoadedRulesPack,
  input: CharHeightInput,
): Outcome<null> {
  const resolved = resolveCharHeight(pack, input);
  if (!resolved.ok) return resolved;
  const { required_mm: required, rule_code: ruleCode } = resolved.value;

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
        ruleRef: ruleCode,
      }],
    };
  }
  return OK;
}

export type ContrastInput = {
  readonly supportRegistry: string;
  /** Reading context (interior/exterior); scopes the rule like legibility. */
  readonly context?: string;
  /** Defaults to CONTRAST.MIN_TEXT_ON_BACKGROUND. */
  readonly code?: string;
  readonly foreground_hex: string;
  readonly background_hex: string;
  readonly entity_id: string;
};

/**
 * Contrast — CONTRAST.MIN_TEXT_ON_BACKGROUND (or the given code). Computes the
 * WCAG luminance-contrast ratio of the two display colours and, when it falls
 * below the resolved minimum, raises LAYOUT.CONTRAST_BELOW_MIN. Scoped by
 * support registry and, when supplied, reading context — the same scope
 * dimensions as the legibility check, so a context-scoped contrast rule
 * resolves consistently.
 */
export function checkContrast(
  pack: LoadedRulesPack,
  input: ContrastInput,
): Outcome<null> {
  const code = input.code ?? 'CONTRAST.MIN_TEXT_ON_BACKGROUND';
  const scope: RuleScopeContext = input.context !== undefined
    ? { supportRegistry: input.supportRegistry, context: input.context }
    : { supportRegistry: input.supportRegistry };
  const resolved = resolveRule(pack, code, scope);
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
        // Full precision decides the verdict; the displayed ratio is rounded.
        params: { ratio: roundHalfAwayFromZero(ratio * 100) / 100, minimum: min },
        ruleRef: rule.code,
      }],
    };
  }
  return OK;
}

export type StrokeToHeightInput = {
  readonly supportRegistry: string;
  readonly ratio: number;
  readonly entity_id: string;
};

/**
 * Legibility double bound — LEGIBILITY.MIN_STROKE_TO_HEIGHT. The stroke-to-height
 * ratio must sit within [min, max]; outside either bound raises
 * LAYOUT.STROKE_RATIO_OUT_OF_BOUNDS.
 */
export function checkStrokeToHeight(
  pack: LoadedRulesPack,
  input: StrokeToHeightInput,
): Outcome<null> {
  const resolved = resolveRule(pack, 'LEGIBILITY.MIN_STROKE_TO_HEIGHT', {
    supportRegistry: input.supportRegistry,
  });
  if (!resolved.ok) return resolved;

  const rule = resolved.value;
  const min = numParam(rule, 'min');
  const max = numParam(rule, 'max');
  if (min === null) return { ok: false, findings: [paramInvalid(rule, 'min')] };
  if (max === null) return { ok: false, findings: [paramInvalid(rule, 'max')] };

  if (input.ratio < min || input.ratio > max) {
    return {
      ok: false,
      findings: [{
        code: 'LAYOUT.STROKE_RATIO_OUT_OF_BOUNDS',
        severity: 'blocking',
        entity: { kind: 'support_face', id: input.entity_id },
        params: { ratio: input.ratio, min, max },
        ruleRef: rule.code,
      }],
    };
  }
  return OK;
}

export type MountingHeightInput = {
  readonly supportRegistry: string;
  readonly context?: string;
  readonly height_mm: number;
  readonly entity_id: string;
};

/**
 * Mounting range — MOUNTING.HEIGHT_RANGE. The mounting height must sit within
 * [min_mm, max_mm]; outside either bound raises LAYOUT.MOUNTING_OUT_OF_RANGE.
 */
export function checkMountingHeight(
  pack: LoadedRulesPack,
  input: MountingHeightInput,
): Outcome<null> {
  const scope: RuleScopeContext = input.context !== undefined
    ? { supportRegistry: input.supportRegistry, context: input.context }
    : { supportRegistry: input.supportRegistry };
  const resolved = resolveRule(pack, 'MOUNTING.HEIGHT_RANGE', scope);
  if (!resolved.ok) return resolved;

  const rule = resolved.value;
  const minMm = numParam(rule, 'min_mm');
  const maxMm = numParam(rule, 'max_mm');
  if (minMm === null) return { ok: false, findings: [paramInvalid(rule, 'min_mm')] };
  if (maxMm === null) return { ok: false, findings: [paramInvalid(rule, 'max_mm')] };

  if (input.height_mm < minMm || input.height_mm > maxMm) {
    return {
      ok: false,
      findings: [{
        code: 'LAYOUT.MOUNTING_OUT_OF_RANGE',
        severity: 'blocking',
        entity: { kind: 'support', id: input.entity_id },
        params: { height_mm: input.height_mm, min_mm: minMm, max_mm: maxMm },
        ruleRef: rule.code,
      }],
    };
  }
  return OK;
}
