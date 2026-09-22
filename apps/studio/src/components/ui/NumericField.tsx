import { type JSX } from 'react';
import { FieldShell } from './Field.js';
import { controlStyle } from './tokens.js';

/**
 * F6, famille « Saisie » — champ numérique avec unité, et champ d'angle.
 *
 * F6.1 est sans réserve : « Un champ numérique affiche toujours son unité. Un
 * champ dimensionnel sans unité affichée est refusé en revue. » L'unité est
 * donc obligatoire dans le type, pas facultative.
 *
 * M7.2 (partie M) : « Toute valeur saisissable au pointeur l'est aussi au
 * clavier, en numérique, dans le panneau et non dans un menu secondaire. »
 * C'est ce champ qui tient cette promesse partout où un geste pose une valeur.
 */
export type NumericFieldProps = {
  readonly label: string;
  /** Obligatoire (F6.1). Écrire `''` serait un contournement. */
  readonly unit: string;
  readonly value: number | null;
  readonly onChange: (value: number | null) => void;
  readonly step?: number | undefined;
  readonly min?: number | undefined;
  readonly max?: number | undefined;
  readonly error?: string | undefined;
  readonly hint?: string | undefined;
  readonly disabled?: boolean | undefined;
  /** M7.3 (partie M) : la valeur est calculée, donc en lecture seule. */
  readonly computed?: boolean | undefined;
};

export function NumericField({
  label, unit, value, onChange, step, min, max, error, hint,
  disabled = false, computed = false,
}: NumericFieldProps): JSX.Element {
  return (
    <FieldShell label={label} unit={unit} error={error} hint={hint} computed={computed}>
      {({ inputId, describedBy }) => (
        <input
          id={inputId}
          type="number"
          inputMode="decimal"
          value={value === null ? '' : String(value)}
          step={step}
          min={min}
          max={max}
          // M7.3 (partie M) : une valeur calculée ne se saisit pas. Le champ
          // reste lisible et atteignable au clavier, mais refuse la frappe.
          readOnly={computed}
          disabled={disabled}
          aria-invalid={error !== undefined}
          aria-readonly={computed}
          aria-describedby={describedBy}
          onChange={e => {
            const raw = e.target.value;
            onChange(raw === '' ? null : Number(raw));
          }}
          style={controlStyle(error !== undefined, disabled || computed)}
        />
      )}
    </FieldShell>
  );
}

/**
 * F6 — champ d'angle. Un champ numérique dont l'unité est fixée et le domaine
 * celui de D1.3 : [0, 360[, convention compas.
 */
export type AngleFieldProps = Omit<NumericFieldProps, 'unit' | 'min' | 'max' | 'step'>;

export function AngleField(props: AngleFieldProps): JSX.Element {
  return <NumericField {...props} unit="°" min={0} max={359.99} step={0.01} />;
}
