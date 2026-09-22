import { type JSX, useId } from 'react';
import { SPACE, TEXT } from './tokens.js';

/**
 * F6, famille « Saisie » — interrupteur.
 *
 * Le libellé dit l'état en toutes lettres, jamais par la seule position du
 * curseur ni par une teinte (M7.7, partie M). Une case à cocher native porte
 * l'état : elle s'annonce correctement aux technologies d'assistance et se
 * manipule à la barre d'espace sans code de notre part.
 */
export type ToggleProps = {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly disabled?: boolean | undefined;
  readonly hint?: string | undefined;
};

export function Toggle({ label, checked, onChange, disabled = false, hint }: ToggleProps): JSX.Element {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
      <label
        htmlFor={id}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: SPACE.sm,
          fontSize: TEXT.body,
          color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
        }}
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-describedby={hint !== undefined ? hintId : undefined}
          onChange={e => { onChange(e.target.checked); }}
        />
        {label}
      </label>
      {hint !== undefined && (
        <span id={hintId} style={{ fontSize: TEXT.micro, color: 'var(--text-muted)' }}>
          {hint}
        </span>
      )}
    </div>
  );
}
