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
 */

import type { Finding } from '@azimut/core-model';

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
// Dangerous patterns to remove
// ---------------------------------------------------------------------------

/** Event handler attributes (onclick, onload, etc.). */
const EVENT_HANDLER_RE = /\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi;

/** Script elements. */
const SCRIPT_TAG_RE = /<script[\s>][\s\S]*?<\/script>/gi;

/** JavaScript URLs. */
const JS_URL_RE = /javascript\s*:/gi;

/** External references (xlink:href to http/https/data). */
const EXTERNAL_HREF_RE = /xlink:href\s*=\s*"(?:https?:|data:)[^"]*"/gi;
const HREF_EXTERNAL_RE = /href\s*=\s*"(?:https?:|data:)[^"]*"/gi;

/** XML external entities. */
const ENTITY_RE = /<!ENTITY[^>]*>/gi;

/** Metadata elements. */
const METADATA_RE = /<metadata[\s>][\s\S]*?<\/metadata>/gi;

/** Processing instructions (<?xml-stylesheet?>). */
const PI_RE = /<\?[\s\S]*?\?>/g;

/** ForeignObject (can contain HTML/scripts). */
const FOREIGN_OBJECT_RE = /<foreignObject[\s>][\s\S]*?<\/foreignObject>/gi;

/** Use elements pointing to external resources. */
const USE_EXTERNAL_RE = /<use[^>]+(?:xlink:)?href\s*=\s*"(?:https?:)[^"]*"[^>]*\/?>/gi;

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
 * Removes dangerous content while preserving vector geometry.
 * This is a client-side pass for preview; the server performs
 * the authoritative sanitization.
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

  let clean = svgContent;

  // Remove dangerous content
  clean = clean.replace(SCRIPT_TAG_RE, '');
  clean = clean.replace(FOREIGN_OBJECT_RE, '');
  clean = clean.replace(EVENT_HANDLER_RE, '');
  clean = clean.replace(JS_URL_RE, '');
  clean = clean.replace(EXTERNAL_HREF_RE, '');
  clean = clean.replace(HREF_EXTERNAL_RE, '');
  clean = clean.replace(ENTITY_RE, '');
  clean = clean.replace(USE_EXTERNAL_RE, '');

  // Remove metadata
  clean = clean.replace(METADATA_RE, '');
  clean = clean.replace(PI_RE, '');

  // Raster image check — use a fresh regex each time to avoid
  // lastIndex statefulness issues with global regexes.
  const hasRaster = /<image[\s>][\s\S]*?(?:\/>|<\/image>)/i.test(clean);

  if (config.forbidRaster && hasRaster) {
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

  // Remove raster images even if not forbidden (just strip them)
  if (!config.forbidRaster && hasRaster) {
    clean = clean.replace(/<image[\s>][\s\S]*?(?:\/>|<\/image>)/gi, '');
    warnings.push({
      code: 'ASSET.SANITIZATION_FAILED',
      severity: 'warning' as const,
      entity: null,
      params: { reason: 'raster_images_removed' },
      ruleRef: 'E14.2',
    });
  }

  return { ok: true, cleanSvg: clean, warnings };
}
