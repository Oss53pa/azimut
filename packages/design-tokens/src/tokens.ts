/**
 * Theme Papier (A11.1) — default theme tokens.
 */
export const themePapier = {
  'surface-page': '#FBFAF8',
  'surface-panel': '#FFFFFF',
  'border': '#E3DFD8',
  'text-primary': '#1C1F24',
  'text-secondary': '#6B7280',
  'accent': '#17457A',
  'accent-secondary': '#2D7A6B',
} as const;

/**
 * Semantic state colors — shared across all themes (A11.1).
 * Reserved for state meaning only, never decorative.
 */
export const stateColors = {
  'state-blocking': '#C2352B',
  'state-warning': '#9A6412',
  'state-valid': '#2E7D4F',
  'state-info': '#2B6CB0',
} as const;

export const isoTokens = {
  'iso-adjacent-opacity': 0.25,
  'iso-exploded-offset-m': 4,
} as const;

export type IsoTokenKey = keyof typeof isoTokens;

export const allTokens = {
  ...themePapier,
  ...stateColors,
} as const;

export type TokenKey = keyof typeof allTokens;
