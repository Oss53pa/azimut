import { type JSX, type ReactNode } from 'react';
import { SPACE, TEXT, NUMERIC_STYLE, severityColor, type Severity } from './tokens.js';

type StateBannerProps = {
  readonly severity: Severity;
  /** Anomaly code (D2). Shown verbatim: it is data, not a label. */
  readonly code?: string | undefined;
  readonly message: string;
  /** What the operator can do about it, already translated. */
  readonly hint?: string | undefined;
  readonly children?: ReactNode | undefined;
};

/**
 * D2 / F4.3 — a refusal or a warning, stated with its code.
 *
 * Severity is carried by a left rule and by the code itself, never by
 * colour alone: the banner still reads in greyscale.
 */
export function StateBanner(
  { severity, code, message, hint, children }: StateBannerProps,
): JSX.Element {
  return (
    <div
      role={severity === 'blocking' ? 'alert' : 'status'}
      style={{
        display: 'flex',
        gap: SPACE.md,
        padding: '8px 12px',
        borderRadius: 4,
        border: '1px solid var(--border-hairline)',
        borderLeft: `3px solid ${severityColor(severity)}`,
        background: 'var(--surface-sunken)',
        minWidth: 0,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        {code !== undefined && (
          <div style={{
            ...NUMERIC_STYLE,
            fontSize: TEXT.micro,
            color: severityColor(severity),
            marginBottom: 2,
          }}>
            {code}
          </div>
        )}
        <div style={{ fontSize: TEXT.small, color: 'var(--text-primary)' }}>{message}</div>
        {hint !== undefined && (
          <div style={{ fontSize: TEXT.micro, color: 'var(--text-secondary)', marginTop: SPACE.xs }}>
            {hint}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

type NoteProps = {
  readonly children: ReactNode;
};

/** A quiet editorial note: what the screen does not claim (F16). */
export function Note({ children }: NoteProps): JSX.Element {
  return (
    <p style={{
      margin: `${String(SPACE.md)}px 0 0`,
      fontSize: TEXT.micro,
      lineHeight: 1.5,
      color: 'var(--text-muted)',
      maxWidth: '68ch',
    }}>
      {children}
    </p>
  );
}
