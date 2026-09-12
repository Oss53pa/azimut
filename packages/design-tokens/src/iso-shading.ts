/**
 * D5.3 — Isometric face shading.
 *
 * The three visible faces of an iso volume (top, left, right) derive from a
 * single base colour by fixed darkening factors. Per the spec these factors are
 * declared here in design-tokens and never computed inside the render engine:
 * the engine receives three ready colours via its theme. `deriveIsoFaceTints`
 * performs that derivation in the token layer so a caller can build the engine
 * theme from a base colour.
 */
export const isoFaceShading = {
  'iso-shade-top': 1,
  'iso-shade-left': 0.82,
  'iso-shade-right': 0.66,
} as const;

export type IsoShadeKey = keyof typeof isoFaceShading;

export type IsoFaceTints = {
  readonly top: string;
  readonly left: string;
  readonly right: string;
};

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function toHex2(n: number): string {
  return clampByte(n).toString(16).padStart(2, '0');
}

function shade(hex: string, factor: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `#${toHex2(r * factor)}${toHex2(g * factor)}${toHex2(b * factor)}`;
}

/** Derive the top/left/right face tints from a base colour (D5.3). */
export function deriveIsoFaceTints(baseHex: string): IsoFaceTints {
  return {
    top: shade(baseHex, isoFaceShading['iso-shade-top']),
    left: shade(baseHex, isoFaceShading['iso-shade-left']),
    right: shade(baseHex, isoFaceShading['iso-shade-right']),
  };
}
