import { type JSX, type ReactNode, useId } from 'react';
import { SPACE, TEXT } from './tokens.js';

/**
 * F6 — l'enveloppe commune des composants de saisie : libellé, unité, état
 * d'erreur, aide.
 *
 * F6.1 : « Un champ numérique affiche toujours son unité. Un champ
 * dimensionnel sans unité affichée est refusé en revue. » L'unité est donc
 * portée par l'enveloppe, pas laissée à chaque écran.
 *
 * M7.3 (partie M) : « Toute valeur calculée est en lecture seule, et son
 * caractère calculé est visible. » `computed` le dit en toutes lettres, jamais
 * par la seule apparence.
 */
export type FieldShellProps = {
  readonly label: string;
  /** Unité affichée à droite du libellé (F6.1). */
  readonly unit?: string | undefined;
  /** Libellé de l'anomalie, quand le champ est en erreur. */
  readonly error?: string | undefined;
  /** Aide permanente, sous le champ. */
  readonly hint?: string | undefined;
  /** M7.3 (partie M) : la valeur est calculée, donc en lecture seule et dite telle. */
  readonly computed?: boolean | undefined;
  readonly children: (ids: { readonly inputId: string; readonly describedBy: string | undefined }) => ReactNode;
};

export function FieldShell({
  label, unit, error, hint, computed = false, children,
}: FieldShellProps): JSX.Element {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const describedBy = [
    error !== undefined ? errorId : null,
    hint !== undefined ? hintId : null,
  ].filter(x => x !== null).join(' ') || undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs, minWidth: 0 }}>
      <label
        htmlFor={inputId}
        style={{
          display: 'flex',
          gap: SPACE.xs,
          alignItems: 'baseline',
          fontSize: TEXT.micro,
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: 'var(--text-secondary)',
        }}
      >
        <span>{label}</span>
        {unit !== undefined && (
          <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--text-muted)' }}>
            {unit}
          </span>
        )}
        {computed && (
          <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--text-muted)' }}>
            {COMPUTED_MARK}
          </span>
        )}
      </label>

      {children({ inputId, describedBy })}

      {hint !== undefined && (
        <span id={hintId} style={{ fontSize: TEXT.micro, color: 'var(--text-muted)' }}>
          {hint}
        </span>
      )}
      {error !== undefined && (
        <span
          id={errorId}
          style={{ fontSize: TEXT.micro, color: 'var(--state-blocking)' }}
        >
          {/* F8 : l'anomalie se lit, la couleur ne fait que la répéter. */}
          {error}
        </span>
      )}
    </div>
  );
}

/**
 * La marque d'une valeur calculée. Un signe, pas une couleur : M7.7 (partie M) refuse
 * qu'une information tienne à la seule couleur.
 */
const COMPUTED_MARK = '=';
