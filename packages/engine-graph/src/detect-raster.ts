import type { Outcome, Finding } from '@azimut/core-model';

/**
 * J5.2 — A pictogram is a monolinear vector drawing; raster content has no
 * place in it. This guard scans a pictogram's SVG source for embedded raster
 * — an `<image>` element, a `data:image/…` URI, or an href pointing at a raster
 * file — and raises PICTO.RASTER_CONTENT for each offending pictogram.
 */
export type PictogramSvg = {
  readonly id: string;
  readonly svg: string;
};

// Deterministic order (array, not object). Each entry detects a raster form.
const RASTER_PATTERNS: readonly [RegExp, string][] = [
  [/<image\b/i, 'image_element'],
  [/data:image\//i, 'data_uri'],
  [/(?:xlink:href|href)\s*=\s*["'][^"']*\.(?:png|jpe?g|gif|webp|bmp|tiff?)\b/i, 'raster_href'],
];

function rasterFormIn(svg: string): string | null {
  for (const [pattern, label] of RASTER_PATTERNS) {
    if (pattern.test(svg)) return label;
  }
  return null;
}

/**
 * Guard that pictogram SVGs contain no raster. Returns one blocking finding per
 * pictogram with raster content, sorted by id; ok when all are pure vector.
 */
export function guardPictogramsVector(
  pictograms: readonly PictogramSvg[],
): Outcome<null> {
  const findings: Finding[] = [];
  const sorted = [...pictograms].sort((a, b) => a.id.localeCompare(b.id));

  for (const picto of sorted) {
    const form = rasterFormIn(picto.svg);
    if (form !== null) {
      findings.push({
        code: 'PICTO.RASTER_CONTENT',
        severity: 'blocking',
        entity: { kind: 'pictogram', id: picto.id },
        params: { form },
        ruleRef: 'J5.2',
      });
    }
  }

  if (findings.length > 0) {
    return { ok: false, findings };
  }
  return { ok: true, value: null, warnings: [] };
}
