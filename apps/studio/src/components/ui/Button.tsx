import { type JSX, type ReactNode } from 'react';
import { TEXT } from './tokens.js';

/**
 * F6, famille « Action » — bouton principal, secondaire, discret.
 *
 * Trois rangs et pas davantage. Un écran qui semble en demander un quatrième
 * demande en réalité qu'on revoie sa hiérarchie d'actions.
 *
 * F6.1 : chaque composant expose ses états. Le repos, le focus et le
 * désactivé sont ici ; le survol et l'actif tiennent aux pseudo-classes, que
 * `theme.css` porte pour tous les boutons.
 */
export type ButtonRank = 'primary' | 'secondary' | 'quiet';

export type ButtonProps = {
  readonly rank?: ButtonRank | undefined;
  readonly onClick: () => void;
  readonly disabled?: boolean | undefined;
  readonly type?: 'button' | 'submit' | undefined;
  readonly children: ReactNode;
};

const RANK_STYLE: Readonly<Record<ButtonRank, { background: string; color: string; border: string }>> = {
  primary: {
    background: 'var(--accent)',
    color: 'var(--surface-panel)',
    border: '1px solid var(--accent)',
  },
  secondary: {
    background: 'var(--surface-panel)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-interactive)',
  },
  quiet: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid transparent',
  },
};

export function Button({
  rank = 'secondary', onClick, disabled = false, type = 'button', children,
}: ButtonProps): JSX.Element {
  const rankStyle = RANK_STYLE[rank];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        font: 'inherit',
        fontSize: TEXT.body,
        padding: '6px 12px',
        borderRadius: 4,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        ...rankStyle,
      }}
    >
      {children}
    </button>
  );
}
