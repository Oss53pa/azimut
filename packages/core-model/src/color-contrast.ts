/**
 * G6.2 / E13 — Luminance-contrast, an accessibility measure computed from
 * display (sRGB) values with the WCAG relative-luminance formula, never a
 * colorimetric measure. Pure and deterministic; the threshold it is compared
 * against is never here — it comes from a loaded rules pack (INV-5).
 */
function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim());
  if (m === null) return null;
  let h = m[1] as string;
  if (h.length === 3) {
    const c0 = h.charAt(0);
    const c1 = h.charAt(1);
    const c2 = h.charAt(2);
    h = c0 + c0 + c1 + c1 + c2 + c2;
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function linearize(channel8bit: number): number {
  const s = channel8bit / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance of a #RGB or #RRGGBB colour, or null if unparsable. */
export function relativeLuminance(hex: string): number | null {
  const rgb = parseHex(hex);
  if (rgb === null) return null;
  return (
    0.2126 * linearize(rgb.r) +
    0.7152 * linearize(rgb.g) +
    0.0722 * linearize(rgb.b)
  );
}

/**
 * WCAG contrast ratio between two colours, in [1, 21], at full precision.
 * Returns null when either colour cannot be parsed. The value is NOT rounded:
 * a pass/fail comparison against a normative threshold must use full precision
 * (a true 4.497 rounded to 4.50 would wrongly clear a 4.5 minimum). Round only
 * for display, at the call site.
 */
export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
