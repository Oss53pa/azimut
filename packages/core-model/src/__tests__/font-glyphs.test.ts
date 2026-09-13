import { describe, it, expect } from 'vitest';
import {
  guardFontGlyphCoverage,
  REQUIRED_LATIN_COVERAGE,
} from '../font-glyphs.js';

const fullCoverage = new Set(REQUIRED_LATIN_COVERAGE);

describe('E12 — guardFontGlyphCoverage (ASSET.FONT_MISSING_GLYPHS)', () => {
  it('passes a font covering the full required set', () => {
    expect(guardFontGlyphCoverage('f-1', fullCoverage).ok).toBe(true);
  });

  it('requires the French accents, not only ASCII letters', () => {
    // ASCII letters only — missing every accent.
    const ascii = new Set(REQUIRED_LATIN_COVERAGE.filter((c) => /[A-Za-z]/.test(c)));
    const r = guardFontGlyphCoverage('f-1', ascii);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings[0]?.code).toBe('ASSET.FONT_MISSING_GLYPHS');
    expect(r.findings[0]?.severity).toBe('blocking');
    expect(r.findings[0]?.ruleRef).toBe('E12');
    expect(String(r.findings[0]?.params['missing'])).toContain('é');
    expect(String(r.findings[0]?.params['missing'])).toContain('ç');
  });

  it('names the missing glyphs in required order', () => {
    const missingCedilla = new Set(fullCoverage);
    missingCedilla.delete('ç');
    missingCedilla.delete('Ç');
    const r = guardFontGlyphCoverage('f-1', missingCedilla);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings[0]?.params['missing']).toBe('çÇ');
    expect(r.findings[0]?.params['missing_count']).toBe(2);
  });

  it('accepts a caller-supplied required set', () => {
    const r = guardFontGlyphCoverage('f-1', new Set(['A', 'B']), ['A', 'B']);
    expect(r.ok).toBe(true);
    const r2 = guardFontGlyphCoverage('f-1', new Set(['A']), ['A', 'B']);
    expect(r2.ok).toBe(false);
  });
});
