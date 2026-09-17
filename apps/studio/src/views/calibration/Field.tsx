import { type JSX } from 'react';
import { SPACE, TEXT, LABEL_STYLE } from '../../components/ui/index.js';
import { FIELD_STYLE } from './field-style.js';

/**
 * Champ de saisie du calage, partagé par les deux sections de l'écran.
 */
type FieldProps = {
  readonly label: string;
  readonly hint: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly inputMode?: 'decimal';
};

export function Field({ label, hint, value, onChange, inputMode }: FieldProps): JSX.Element {
  return (
    <label style={{ display: 'grid', gap: SPACE.xs }}>
      <span style={LABEL_STYLE}>{label}</span>
      <input
        type="text"
        inputMode={inputMode}
        value={value}
        onChange={(e) => { onChange(e.target.value); }}
        style={{ ...FIELD_STYLE, fontFamily: 'var(--font-mono)' }}
      />
      <span style={{ fontSize: TEXT.micro, color: 'var(--text-muted)' }}>{hint}</span>
    </label>
  );
}
