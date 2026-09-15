/**
 * F2 / F3 — style objects shared by the module screens.
 *
 * Every colour is a theme token: no literal colour is written here (A2.4).
 * The spacing scale has base 4 and the radii are 0 / 4 / 6 (partie F).
 */
import type { CSSProperties } from 'react';

export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

/** F3.2 — text sizes run 11 to 22, in two weights only. */
export const TEXT = {
  micro: 11,
  small: 12,
  body: 13,
  lead: 15,
  section: 17,
  title: 22,
} as const;

export const PANEL_STYLE: CSSProperties = {
  border: '1px solid var(--border-hairline)',
  borderRadius: 6,
  background: 'var(--surface-panel)',
  minWidth: 0,
};

export const PANEL_HEADER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: SPACE.sm,
  padding: '8px 12px',
  borderBottom: '1px solid var(--border-hairline)',
};

export const LABEL_STYLE: CSSProperties = {
  fontSize: TEXT.micro,
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-secondary)',
};

export const NUMERIC_STYLE: CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  fontFamily: 'var(--font-mono)',
};

export const BUTTON_STYLE: CSSProperties = {
  border: '1px solid var(--border-interactive)',
  background: 'var(--surface-panel)',
  color: 'var(--text-primary)',
  fontFamily: 'inherit',
  fontSize: TEXT.small,
  padding: '6px 12px',
  borderRadius: 4,
  cursor: 'pointer',
};

export const PRIMARY_BUTTON_STYLE: CSSProperties = {
  ...BUTTON_STYLE,
  border: '1px solid var(--text-primary)',
  background: 'var(--text-primary)',
  color: 'var(--surface-panel)',
  fontWeight: 500,
  padding: '6px 16px',
};

export type Severity = 'blocking' | 'warning' | 'info' | 'valid';

/** F4.3 — state colour is never decorative; each severity has one token. */
export function severityColor(severity: Severity): string {
  switch (severity) {
    case 'blocking': return 'var(--state-blocking)';
    case 'warning': return 'var(--state-warning)';
    case 'info': return 'var(--state-info)';
    case 'valid': return 'var(--state-valid)';
  }
}
