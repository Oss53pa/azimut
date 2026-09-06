/**
 * E12 — Deterministic text measurement.
 *
 * Text measurement is computed from font metrics, NEVER from
 * browser measurement (which varies by engine, system, and DPI).
 * This is a condition of INV-4 (deterministic rendering).
 *
 * Overflow detection is computed, never visual (E12).
 * Measurement uses the longest language variant among active
 * languages, per D12.2.
 */

// ---------------------------------------------------------------------------
// Font metrics (loaded from font data, not from browser)
// ---------------------------------------------------------------------------

export type FontMetrics = {
  /** Font identifier. */
  readonly fontId: string;
  /** Units per em (typically 1000 or 2048). */
  readonly unitsPerEm: number;
  /** Ascender in font units (positive above baseline). */
  readonly ascender: number;
  /** Descender in font units (negative below baseline). */
  readonly descender: number;
  /** Line gap in font units. */
  readonly lineGap: number;
  /** Average character width in font units. */
  readonly avgCharWidth: number;
  /** Map of character widths for known glyphs (codePoint → width in font units). */
  readonly charWidths: Readonly<Record<number, number>>;
};

// ---------------------------------------------------------------------------
// Text style
// ---------------------------------------------------------------------------

export type TextStyle = {
  /** Font size in meters (physical height on the sign). */
  readonly fontSize_m: number;
  /** Letter spacing in meters (0 = normal). */
  readonly letterSpacing_m: number;
  /** Line height multiplier (1.2 = 120% of font size). */
  readonly lineHeight: number;
  /** Text alignment. */
  readonly align: 'left' | 'center' | 'right';
  /** Text transform. */
  readonly transform: 'none' | 'uppercase' | 'lowercase';
  /** Hyphenation: disabled by default on signs (E12). */
  readonly hyphenation: boolean;
};

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontSize_m: 0.05,
  letterSpacing_m: 0,
  lineHeight: 1.2,
  align: 'left',
  transform: 'none',
  hyphenation: false,
};

// ---------------------------------------------------------------------------
// Measurement results
// ---------------------------------------------------------------------------

export type TextMeasurement = {
  /** Total width in meters. */
  readonly width_m: number;
  /** Total height in meters. */
  readonly height_m: number;
  /** Number of lines. */
  readonly lineCount: number;
  /** Whether the text overflows the given bounds. */
  readonly overflows: boolean;
};

// ---------------------------------------------------------------------------
// Character width lookup
// ---------------------------------------------------------------------------

function charWidth(metrics: FontMetrics, codePoint: number): number {
  return metrics.charWidths[codePoint] ?? metrics.avgCharWidth;
}

// ---------------------------------------------------------------------------
// Core measurement
// ---------------------------------------------------------------------------

/**
 * Measure a single line of text using font metrics.
 * Returns width in meters.
 */
export function measureLine(
  text: string,
  metrics: FontMetrics,
  style: TextStyle,
): number {
  const transformed = applyTransform(text, style.transform);
  const scale = style.fontSize_m / metrics.unitsPerEm;
  let width = 0;

  for (let i = 0; i < transformed.length; i++) {
    const cp = transformed.codePointAt(i);
    if (cp === undefined) continue;
    width += charWidth(metrics, cp) * scale;
    if (i < transformed.length - 1) {
      width += style.letterSpacing_m;
    }
    // Handle surrogate pairs
    if (cp > 0xFFFF) i++;
  }

  return width;
}

/**
 * Compute line height in meters.
 */
export function computeLineHeight(
  metrics: FontMetrics,
  style: TextStyle,
): number {
  return style.fontSize_m * style.lineHeight;
}

/**
 * Measure text within a bounding box.
 *
 * No word-wrapping is applied (signs typically don't wrap).
 * Each line break in the text creates a new line.
 * Overflow is detected if the text exceeds the given bounds.
 *
 * @param text - The text to measure (may contain \n).
 * @param metrics - Font metrics.
 * @param style - Text style.
 * @param maxWidth_m - Maximum width in meters (null = no limit).
 * @param maxHeight_m - Maximum height in meters (null = no limit).
 */
export function measureText(
  text: string,
  metrics: FontMetrics,
  style: TextStyle,
  maxWidth_m: number | null,
  maxHeight_m: number | null,
): TextMeasurement {
  const lines = text.split('\n');
  const lineH = computeLineHeight(metrics, style);

  let maxLineWidth = 0;
  for (const line of lines) {
    const w = measureLine(line, metrics, style);
    if (w > maxLineWidth) maxLineWidth = w;
  }

  const totalHeight = lineH * lines.length;

  const overflowsWidth = maxWidth_m !== null && maxLineWidth > maxWidth_m;
  const overflowsHeight = maxHeight_m !== null && totalHeight > maxHeight_m;

  return {
    width_m: maxLineWidth,
    height_m: totalHeight,
    lineCount: lines.length,
    overflows: overflowsWidth || overflowsHeight,
  };
}

// ---------------------------------------------------------------------------
// Multi-language measurement (D12.2)
// ---------------------------------------------------------------------------

/**
 * Measure text across all active languages and return the
 * measurement of the longest variant. Per D12.2, sizing uses
 * the worst case among active languages.
 */
export function measureLongestVariant(
  variants: Readonly<Record<string, string>>,
  activeLangs: readonly string[],
  metrics: FontMetrics,
  style: TextStyle,
  maxWidth_m: number | null,
  maxHeight_m: number | null,
): TextMeasurement {
  let worst: TextMeasurement | null = null;

  for (const lang of activeLangs) {
    const text = variants[lang];
    if (text === undefined) continue;
    const m = measureText(text, metrics, style, maxWidth_m, maxHeight_m);
    if (worst === null || m.width_m > worst.width_m) {
      worst = m;
    }
  }

  if (worst === null) {
    return { width_m: 0, height_m: 0, lineCount: 0, overflows: false };
  }

  return worst;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function applyTransform(text: string, transform: TextStyle['transform']): string {
  switch (transform) {
    case 'uppercase': return text.toUpperCase();
    case 'lowercase': return text.toLowerCase();
    case 'none': return text;
  }
}
