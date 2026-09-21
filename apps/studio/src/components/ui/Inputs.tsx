import { type JSX } from 'react';
import { FieldShell } from './Field.js';
import { controlStyle } from './tokens.js';
import { SPACE, TEXT } from './tokens.js';

/**
 * F6, famille « Saisie » — champ texte, sélecteur, choix multiple.
 *
 * Aucun n'est nouveau au sens de M6 : les trois figurent dans la liste fermée
 * de F6. Ce fichier les construit, il ne l'étend pas.
 *
 * E6.2 et M7.2 (partie M) : « Toute valeur saisissable au pointeur l'est aussi
 * au clavier, en numérique, dans le panneau et non dans un menu secondaire. »
 * Les trois sont des éléments de formulaire natifs, donc au clavier par
 * construction, et aucun n'enferme sa valeur dans un geste.
 */

export type TextFieldProps = {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly error?: string | undefined;
  readonly hint?: string | undefined;
  readonly maxLength?: number | undefined;
  readonly disabled?: boolean | undefined;
  readonly autoFocus?: boolean | undefined;
};

export function TextField({
  label, value, onChange, error, hint, maxLength, disabled = false, autoFocus = false,
}: TextFieldProps): JSX.Element {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {({ inputId, describedBy }) => (
        <input
          id={inputId}
          type="text"
          value={value}
          disabled={disabled}
          maxLength={maxLength}
          autoFocus={autoFocus}
          aria-invalid={error !== undefined}
          aria-describedby={describedBy}
          onChange={e => { onChange(e.target.value); }}
          style={controlStyle(error !== undefined, disabled)}
        />
      )}
    </FieldShell>
  );
}

export type Option = {
  readonly value: string;
  readonly label: string;
};

export type SelectFieldProps = {
  readonly label: string;
  readonly value: string;
  readonly options: readonly Option[];
  readonly onChange: (value: string) => void;
  /** Libellé de l'entrée vide. Absent, le sélecteur n'en propose pas. */
  readonly placeholder?: string | undefined;
  readonly error?: string | undefined;
  readonly hint?: string | undefined;
  readonly disabled?: boolean | undefined;
};

export function SelectField({
  label, value, options, onChange, placeholder, error, hint, disabled = false,
}: SelectFieldProps): JSX.Element {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {({ inputId, describedBy }) => (
        <select
          id={inputId}
          value={value}
          disabled={disabled}
          aria-invalid={error !== undefined}
          aria-describedby={describedBy}
          onChange={e => { onChange(e.target.value); }}
          style={controlStyle(error !== undefined, disabled)}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}

export type MultiChoiceProps = {
  readonly label: string;
  readonly options: readonly Option[];
  readonly selected: readonly string[];
  readonly onChange: (selected: readonly string[]) => void;
  readonly error?: string | undefined;
  readonly hint?: string | undefined;
  readonly disabled?: boolean | undefined;
};

/**
 * F6 « choix multiple ». Un groupe de cases à cocher, et non une liste à
 * sélection multiple : celle-ci se manipule mal au clavier et cache ce qui
 * n'est pas choisi.
 */
export function MultiChoice({
  label, options, selected, onChange, error, hint, disabled = false,
}: MultiChoiceProps): JSX.Element {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {({ describedBy }) => (
        <div
          role="group"
          aria-label={label}
          aria-describedby={describedBy}
          style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE.md }}
        >
          {options.map(o => {
            const checked = selected.includes(o.value);
            return (
              <label
                key={o.value}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: SPACE.xs,
                  fontSize: TEXT.body,
                  color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => {
                    onChange(checked
                      ? selected.filter(v => v !== o.value)
                      : [...selected, o.value]);
                  }}
                />
                {o.label}
              </label>
            );
          })}
        </div>
      )}
    </FieldShell>
  );
}
