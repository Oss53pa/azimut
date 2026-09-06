/**
 * E13 — Color management.
 *
 * Charter colors are expressed in Pantone or RAL references.
 * Screen displays in RGB, fabrication works in CMYK or spot color.
 *
 * A charter color carries:
 *   - its reference of origin (authoritative for the manufacturer),
 *   - its display value (screen preview),
 *   - its output profile per substrate.
 *
 * No automatic conversion is presented as exact. The screen is
 * a preview, and the UI says so (E13).
 *
 * Contrast computation uses relative luminance on display values.
 * Safety registry colors come from the rules pack and are used
 * as-is, never converted or approximated (INV-3).
 */

import type { Finding } from '@azimut/core-model';

// ---------------------------------------------------------------------------
// Charter color types
// ---------------------------------------------------------------------------

export type ColorReference =
  | { readonly system: 'pantone'; readonly code: string }
  | { readonly system: 'ral'; readonly code: string }
  | { readonly system: 'custom'; readonly name: string };

export type RGBColor = {
  readonly r: number; // 0-255
  readonly g: number;
  readonly b: number;
};

export type CMYKColor = {
  readonly c: number; // 0-100
  readonly m: number;
  readonly y: number;
  readonly k: number;
};

export type OutputProfile = {
  readonly substrate: string;
  readonly colorSpace: 'cmyk' | 'spot';
  readonly cmyk: CMYKColor | null;
  readonly spotReference: string | null;
};

export type CharterColor = {
  readonly id: string;
  readonly roleId: string;
  /** Reference of origin — authoritative for the manufacturer. */
  readonly reference: ColorReference;
  /** Display value for screen preview. */
  readonly display: RGBColor;
  /** Output profiles by substrate. */
  readonly outputProfiles: readonly OutputProfile[];
};

// ---------------------------------------------------------------------------
// Relative luminance (WCAG 2.1)
// ---------------------------------------------------------------------------

function sRGBToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * Compute relative luminance per WCAG 2.1.
 */
export function relativeLuminance(color: RGBColor): number {
  return (
    0.2126 * sRGBToLinear(color.r) +
    0.7152 * sRGBToLinear(color.g) +
    0.0722 * sRGBToLinear(color.b)
  );
}

/**
 * Compute contrast ratio between two colors (WCAG 2.1).
 * Result is always >= 1.
 */
export function contrastRatio(a: RGBColor, b: RGBColor): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

// ---------------------------------------------------------------------------
// Output profile validation
// ---------------------------------------------------------------------------

/**
 * Check that a charter color has an output profile for the given substrate.
 * Returns COLOR.PROFILE_MISSING if not found.
 */
export function checkOutputProfile(
  color: CharterColor,
  substrate: string,
): Finding | null {
  const profile = color.outputProfiles.find(p => p.substrate === substrate);
  if (profile !== undefined) return null;

  return {
    code: 'COLOR.PROFILE_MISSING',
    severity: 'warning',
    entity: { kind: 'charter_color', id: color.id },
    params: {
      colorId: color.id,
      roleId: color.roleId,
      substrate,
    },
    ruleRef: 'E13',
  };
}

// ---------------------------------------------------------------------------
// Color role resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a style role to its display color.
 * Returns the RGB display value for rendering.
 *
 * @param roleId - The charter role id.
 * @param palette - Map of role ids to charter colors.
 */
export function resolveDisplayColor(
  roleId: string,
  palette: Readonly<Record<string, CharterColor>>,
): RGBColor | null {
  const color = palette[roleId];
  if (color === undefined) return null;
  return color.display;
}

/**
 * Format RGB as CSS color string for rendering.
 * Note: hex color literals are not hardcoded in business code.
 * This function is the single conversion point.
 */
export function rgbToCss(color: RGBColor): string {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

/**
 * Format a color reference for display to the user.
 */
export function formatReference(ref: ColorReference): string {
  switch (ref.system) {
    case 'pantone': return `Pantone ${ref.code}`;
    case 'ral': return `RAL ${ref.code}`;
    case 'custom': return ref.name;
  }
}
