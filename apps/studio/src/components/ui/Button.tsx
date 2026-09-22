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

/**
 * Les trois rangs, et aucun n'emploie l'accent.
 *
 * M7.10 (partie M) : « L'accent ne signale que ce que le logiciel a calculé. »
 * La partie F le dit deux fois : « accent réservé aux valeurs produites par un
 * moteur », et « ce que l'utilisateur a saisi reste neutre. Le concepteur
 * distingue ainsi d'un coup d'œil ce qu'il a décidé de ce qui lui est
 * proposé. »
 *
 * Un bouton est une action, jamais une valeur calculée. Le bouton principal
 * tirait sa teinte de l'accent : il la prend désormais d'un neutre inversé,
 * qui le détache autant sans mentir sur la nature de ce qu'il porte.
 */
const RANK_STYLE: Readonly<Record<ButtonRank, { background: string; color: string; border: string }>> = {
  primary: {
    background: 'var(--text-primary)',
    color: 'var(--surface-panel)',
    border: '1px solid var(--text-primary)',
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
