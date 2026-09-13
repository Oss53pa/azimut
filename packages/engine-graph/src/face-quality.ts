import type { Finding, Outcome } from '@azimut/core-model';
import { checkContrast, type LoadedRulesPack } from '@azimut/rules';
import type { FaceTheme } from './render-face.js';

/**
 * G6.2 / E13 — Face-level contrast control, wired to the render pipeline's own
 * colours. The face theme's text and accent (pictogram) colours are each
 * checked against the background using thresholds resolved from a loaded rules
 * pack — never a value in code (INV-5). An absent rule propagates
 * RULES.RULE_NOT_FOUND: the product refuses rather than inventing a threshold.
 */
export type FaceContrastInput = {
  readonly face_id: string;
  readonly supportRegistry: string;
  readonly theme: FaceTheme;
};

export function checkFaceContrast(
  pack: LoadedRulesPack,
  input: FaceContrastInput,
): Outcome<null> {
  const findings: Finding[] = [];

  const text = checkContrast(pack, {
    supportRegistry: input.supportRegistry,
    code: 'CONTRAST.MIN_TEXT_ON_BACKGROUND',
    foreground_hex: input.theme.text_primary,
    background_hex: input.theme.background,
    entity_id: input.face_id,
  });
  if (!text.ok) findings.push(...text.findings);

  const pictogram = checkContrast(pack, {
    supportRegistry: input.supportRegistry,
    code: 'CONTRAST.MIN_PICTOGRAM_ON_BACKGROUND',
    foreground_hex: input.theme.accent,
    background_hex: input.theme.background,
    entity_id: input.face_id,
  });
  if (!pictogram.ok) findings.push(...pictogram.findings);

  if (findings.length > 0) return { ok: false, findings };
  return { ok: true, value: null, warnings: [] };
}
