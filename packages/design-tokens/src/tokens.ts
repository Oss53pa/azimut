/**
 * Theme Papier (F2) — light theme tokens.
 * Warm neutral palette, default for design application.
 */
export const themePapier = {
  'surface-page': '#FBFAF8',
  'surface-panel': '#FFFFFF',
  'surface-canvas': '#F7F5F1',
  'surface-sunken': '#F2EEE8',
  'border-hairline': '#E3DFD8',
  'border-strong': '#CFC8BC',
  'border-interactive': '#8E867C',
  'text-primary': '#1C1F24',
  'text-secondary': '#5A606B',
  'text-muted': '#656B75',
  'accent': '#17457A',
  'accent-soft': '#EDF2F8',
  'accent-secondary': '#26695C',
} as const;

/**
 * Theme Instrument (F2) — dark theme tokens.
 * Same semantic keys, values adjusted for dark ground.
 */
export const themeInstrument = {
  'surface-page': '#16181C',
  'surface-panel': '#1E2126',
  'surface-canvas': '#F7F5F1',
  'surface-sunken': '#24272D',
  'border-hairline': '#32363D',
  'border-strong': '#4A4F58',
  'border-interactive': '#8A9099',
  'text-primary': '#E9E7E3',
  'text-secondary': '#A6ADB7',
  'text-muted': '#9198A2',
  'accent': '#8FB4E0',
  'accent-soft': '#20303F',
  'accent-secondary': '#77C4B2',
} as const;

/**
 * Semantic state colors — Papier theme (F2.3).
 * Reserved for state meaning only, never decorative.
 */
export const stateColorsPapier = {
  'state-blocking': '#B32F26',
  'state-warning': '#96560A',
  'state-valid': '#2A7047',
  'state-info': '#2B6CB0',
} as const;

/**
 * Semantic state colors — Instrument theme (F2.3).
 * Adjusted for legibility on dark backgrounds.
 */
export const stateColorsInstrument = {
  'state-blocking': '#E88478',
  'state-warning': '#DCA24A',
  'state-valid': '#63C08A',
  'state-info': '#79ACDF',
} as const;

/** Backward-compatible alias — Papier state colors. */
export const stateColors = stateColorsPapier;

export const isoTokens = {
  'iso-adjacent-opacity': 0.25,
  'iso-exploded-offset-m': 4,
} as const;

export type IsoTokenKey = keyof typeof isoTokens;

export const allTokens = {
  ...themePapier,
  ...stateColorsPapier,
} as const;

export type ThemeTokenKey = keyof typeof themePapier;
export type StateTokenKey = keyof typeof stateColorsPapier;
export type TokenKey = keyof typeof allTokens;

/**
 * Kiosk tokens (F13) — minimal set for public-facing kiosk.
 */
export const kioskTokens = {
  'k-bg': '#FFFFFF',
  'k-fg': '#1C1F24',
  'k-line': '#CFC8BC',
  'k-sunken': '#F2EEE8',
} as const;

export const kioskTokensHighContrast = {
  'k-bg': '#000000',
  'k-fg': '#FFFFFF',
  'k-line': '#FFFFFF',
  'k-sunken': '#000000',
} as const;

export type KioskTokenKey = keyof typeof kioskTokens;

/**
 * Typographic scale (F3.4). Base 13 px. Seven roles; two weights only (400,
 * 500). Any font size off {11,12,13,15,18,22} or weight off {400,500} is a
 * non-conformity (F16 static analysis).
 */
export const typeScale = {
  micro: { size: 11, weight: 400, lineHeight: 1.4 },
  fieldLabel: { size: 12, weight: 400, lineHeight: 1.4 },
  body: { size: 13, weight: 400, lineHeight: 1.5 },
  value: { size: 13, weight: 500, lineHeight: 1.4 },
  panelTitle: { size: 15, weight: 500, lineHeight: 1.3 },
  screenTitle: { size: 18, weight: 500, lineHeight: 1.25 },
  docTitle: { size: 22, weight: 500, lineHeight: 1.2 },
} as const;

export type TypeRole = keyof typeof typeScale;

export const TYPE_SIZES = [11, 12, 13, 15, 18, 22] as const;
export const TYPE_WEIGHTS = [400, 500] as const;

export function isAllowedFontSize(value: number): boolean {
  return (TYPE_SIZES as readonly number[]).includes(value);
}

export function isAllowedFontWeight(value: number): boolean {
  return (TYPE_WEIGHTS as readonly number[]).includes(value);
}

/**
 * Spacing scale (F4.1). Base 4 px; only these values are allowed, plus 0.
 * Any spacing value off this scale is a non-conformity (F16 static analysis).
 */
export const SPACING_SCALE = [2, 4, 6, 8, 12, 16, 20, 24, 32, 48] as const;

/** Spacing tokens, keyed by pixel value for direct lookup. */
export const spacing = {
  '2': 2, '4': 4, '6': 6, '8': 8, '12': 12,
  '16': 16, '20': 20, '24': 24, '32': 32, '48': 48,
} as const;

export type SpacingKey = keyof typeof spacing;

/** True when a numeric spacing value is on the scale (0 always allowed). */
export function isAllowedSpacing(value: number): boolean {
  return value === 0 || (SPACING_SCALE as readonly number[]).includes(value);
}

/**
 * Border radii (F4.3). Three values encode element nature: 0 for panels/bars/
 * rows, 4 for fields/buttons/pastilles, 6 for floating elements. No fourth
 * value; any other radius is a non-conformity (F16 static analysis).
 */
export const radii = {
  none: 0,
  small: 4,
  floating: 6,
} as const;

export const RADIUS_SCALE = [0, 4, 6] as const;

export function isAllowedRadius(value: number): boolean {
  return (RADIUS_SCALE as readonly number[]).includes(value);
}

/**
 * Motion durations in ms (F11).
 * Three durations only — no fourth without stop-and-ask.
 */
export const durations = {
  state: 120,
  float: 200,
  panel: 240,
} as const;
