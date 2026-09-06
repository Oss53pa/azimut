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
  'text-muted': '#7C838D',
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
 * Border radii (F2.2).
 * Three values only — no fourth without stop-and-ask.
 */
export const radii = {
  none: 0,
  small: 4,
  floating: 6,
} as const;

/**
 * Motion durations in ms (F11).
 * Three durations only — no fourth without stop-and-ask.
 */
export const durations = {
  state: 120,
  float: 200,
  panel: 240,
} as const;
