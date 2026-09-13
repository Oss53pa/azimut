import type { Finding, Outcome } from './outcome.js';

/**
 * E12 / E14.2 — Charter fonts are validated on import: the Latin character sets
 * needed for French and English, accents included, must be present. A font that
 * lacks a required glyph raises a blocking ASSET.FONT_MISSING_GLYPHS, since a
 * missing accent would silently corrupt a panel.
 *
 * The required coverage below is the basic Latin letters plus the French
 * accented letters that fonts commonly lack; it is a technical coverage set,
 * not a regulatory value, and callers may pass their own required set.
 */
const ASCII_LETTERS: readonly string[] = (() => {
  const letters: string[] = [];
  for (let c = 0x41; c <= 0x5a; c++) letters.push(String.fromCharCode(c)); // A–Z
  for (let c = 0x61; c <= 0x7a; c++) letters.push(String.fromCharCode(c)); // a–z
  return letters;
})();

const FRENCH_ACCENTS: readonly string[] = [
  'à', 'â', 'ä', 'À', 'Â', 'Ä',
  'ç', 'Ç',
  'é', 'è', 'ê', 'ë', 'É', 'È', 'Ê', 'Ë',
  'î', 'ï', 'Î', 'Ï',
  'ô', 'ö', 'Ô', 'Ö',
  'ù', 'û', 'ü', 'Ù', 'Û', 'Ü',
  'ÿ', 'Ÿ',
  'œ', 'Œ', 'æ', 'Æ',
];

export const REQUIRED_LATIN_COVERAGE: readonly string[] = [
  ...ASCII_LETTERS,
  ...FRENCH_ACCENTS,
];

/**
 * Guard that a font covers the required glyphs. `available` is the set of
 * characters the font provides. Returns a blocking ASSET.FONT_MISSING_GLYPHS
 * naming the missing characters (in required order) when any are absent; ok
 * when coverage is complete.
 */
export function guardFontGlyphCoverage(
  fontId: string,
  available: ReadonlySet<string>,
  required: readonly string[] = REQUIRED_LATIN_COVERAGE,
): Outcome<null> {
  const missing = required.filter((ch) => !available.has(ch));
  if (missing.length === 0) {
    return { ok: true, value: null, warnings: [] };
  }

  const finding: Finding = {
    code: 'ASSET.FONT_MISSING_GLYPHS',
    severity: 'blocking',
    entity: { kind: 'font', id: fontId },
    params: { missing: missing.join(''), missing_count: missing.length },
    ruleRef: 'E12',
  };
  return { ok: false, findings: [finding] };
}
