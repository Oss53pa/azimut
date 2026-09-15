import { type JSX } from 'react';
import { TEXT, severityColor, type Severity } from './tokens.js';

type TagProps = {
  readonly label: string;
  readonly severity?: Severity | undefined;
  /** Neutral tags carry no state and take the muted border. */
  readonly muted?: boolean | undefined;
};

/**
 * F4.3 — a state chip. The label always says the state in words; the
 * colour only repeats it, so the chip survives greyscale.
 */
export function Tag({ label, severity, muted = false }: TagProps): JSX.Element {
  const color = severity === undefined
    ? (muted ? 'var(--text-muted)' : 'var(--text-secondary)')
    : severityColor(severity);
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 6px',
      borderRadius: 4,
      border: `1px solid ${color}`,
      color,
      fontSize: TEXT.micro,
      lineHeight: 1.6,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}
