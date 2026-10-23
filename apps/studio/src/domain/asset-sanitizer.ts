/**
 * E14.2 — Asset sanitization.
 *
 * Before any storage, imported SVG assets must be sanitized:
 * - Remove all scripts, event handlers, external references, external entities.
 * - Remove metadata (tool info, author info).
 * - Reject files exceeding size or complexity thresholds.
 * - Preserve vectors; reject raster images in logos.
 * - An unsanitized asset is NEVER rendered. The `sanitized` field is authoritative.
 *
 * This runs client-side for preview, but authoritative sanitization
 * happens server-side in an isolated environment (E14.1).
 *
 * Vit dans `domain/` et non dans `editor/` : l'assainissement n'est pas une
 * affaire d'éditeur. Le module 05 le fait passer sur les visuels reçus d'un
 * annonceur (M05.R5 (partie N)), et l'éditeur le fera passer sur les actifs importés.
 */

import type { Finding } from '@azimut/core-model';
import { rewriteSvg } from './svg-whitelist.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export type SanitizeConfig = {
  /** Maximum SVG file size in bytes. */
  readonly maxFileSize: number;
  /** Maximum number of SVG elements. */
  readonly maxElements: number;
  /** Whether raster images are forbidden (logos). */
  readonly forbidRaster: boolean;
};

export const DEFAULT_SANITIZE_CONFIG: SanitizeConfig = {
  maxFileSize: 5 * 1024 * 1024, // 5 MB
  maxElements: 10000,
  forbidRaster: false,
};

export const LOGO_SANITIZE_CONFIG: SanitizeConfig = {
  ...DEFAULT_SANITIZE_CONFIG,
  forbidRaster: true,
};

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type SanitizeResult =
  | { readonly ok: true; readonly cleanSvg: string; readonly warnings: readonly Finding[] }
  | { readonly ok: false; readonly finding: Finding };

// ---------------------------------------------------------------------------
// Element counting
// ---------------------------------------------------------------------------

function countElements(svg: string): number {
  // Count opening tags (rough but sufficient for complexity check)
  const matches = svg.match(/<[a-zA-Z]/g);
  return matches?.length ?? 0;
}

// ---------------------------------------------------------------------------
// Core sanitization
// ---------------------------------------------------------------------------

/**
 * Sanitize an SVG string.
 *
 * Rewrites the SVG from a whitelist (`svg-whitelist.ts`) while preserving
 * vector geometry: what the whitelist does not know is removed, what does not
 * parse is refused. This is a client-side pass for preview; the server
 * performs the authoritative sanitization.
 */
export function sanitizeSvg(
  svgContent: string,
  config: SanitizeConfig = DEFAULT_SANITIZE_CONFIG,
): SanitizeResult {
  const warnings: Finding[] = [];

  // Size check
  const sizeBytes = new TextEncoder().encode(svgContent).length;
  if (sizeBytes > config.maxFileSize) {
    return {
      ok: false,
      finding: {
        code: 'ASSET.SANITIZATION_FAILED',
        severity: 'blocking',
        entity: null,
        params: { reason: 'file_too_large', size: sizeBytes, max: config.maxFileSize },
        ruleRef: 'E14.2',
      },
    };
  }

  // Complexity check
  const elementCount = countElements(svgContent);
  if (elementCount > config.maxElements) {
    return {
      ok: false,
      finding: {
        code: 'ASSET.SANITIZATION_FAILED',
        severity: 'blocking',
        entity: null,
        params: { reason: 'too_complex', elements: elementCount, max: config.maxElements },
        ruleRef: 'E14.2',
      },
    };
  }

  // Réécriture par liste blanche : rien n'est recopié tel quel du fichier reçu.
  const rewritten = rewriteSvg(svgContent);
  if (!rewritten.ok) {
    return {
      ok: false,
      finding: {
        code: 'ASSET.SANITIZATION_FAILED',
        severity: 'blocking',
        entity: null,
        params: { reason: rewritten.reason },
        ruleRef: 'E14.2',
      },
    };
  }

  if (config.forbidRaster && rewritten.rasterFound) {
    return {
      ok: false,
      finding: {
        code: 'ASSET.RASTER_IN_LOGO',
        severity: 'blocking',
        entity: null,
        params: { reason: 'raster_in_logo' },
        ruleRef: 'E14.2',
      },
    };
  }

  // Hors logo, une image en mode point est retirée, et le retrait est signalé.
  if (rewritten.rasterFound) {
    warnings.push({
      code: 'ASSET.SANITIZATION_FAILED',
      severity: 'warning' as const,
      entity: null,
      params: { reason: 'raster_images_removed' },
      ruleRef: 'E14.2',
    });
  }

  return { ok: true, cleanSvg: rewritten.svg, warnings };
}
