import { type JSX, type ReactNode } from 'react';
import { SPACE, TEXT } from './tokens.js';

/**
 * F6, famille « Structure » — barre d'outils et barre d'état.
 *
 * La barre d'outils est un groupe de boutons à bascule : un seul outil est
 * actif, et l'outil actif se lit au texte et à l'état ARIA, jamais à la seule
 * teinte (M7.7, partie M). La touche de chaque outil est annoncée dans le
 * nom accessible : sans cela, le raccourci n'existe que dans la documentation.
 */
export type ToolbarItem = {
  readonly id: string;
  readonly label: string;
  /** La touche qui active l'outil, telle que la partie M la donne. */
  readonly key: string;
};

export type ToolbarProps = {
  readonly label: string;
  readonly items: readonly ToolbarItem[];
  readonly active: string;
  readonly onSelect: (id: string) => void;
  readonly disabled?: boolean | undefined;
};

export function Toolbar({ label, items, active, onSelect, disabled = false }: ToolbarProps): JSX.Element {
  return (
    <div
      role="toolbar"
      aria-label={label}
      aria-orientation="vertical"
      style={{
        display: 'flex', flexDirection: 'column', gap: SPACE.xs,
        padding: SPACE.sm,
        borderRight: '1px solid var(--border-hairline)',
      }}
    >
      {items.map(item => {
        const selected = item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={selected}
            aria-keyshortcuts={item.key}
            disabled={disabled}
            onClick={() => { onSelect(item.id); }}
            style={{
              font: 'inherit',
              fontSize: TEXT.small,
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: SPACE.sm,
              padding: '4px 8px',
              borderRadius: 4,
              cursor: disabled ? 'default' : 'pointer',
              // L'outil actif porte une bordure pleine, les autres une bordure
              // transparente : la distinction tient au trait, pas à la teinte.
              border: `1px solid ${selected ? 'var(--border-strong)' : 'transparent'}`,
              background: selected ? 'var(--surface-sunken)' : 'transparent',
              color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
            }}
          >
            <span>{item.label}</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              {item.key}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * F6 — barre d'état. Des couples libellé/valeur, en bas de l'écran d'atelier.
 * Chaque valeur porte son libellé : une valeur seule ne se lit pas.
 */
export type StatusItem = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
};

export function StatusBar({ items, children }: {
  readonly items: readonly StatusItem[];
  readonly children?: ReactNode;
}): JSX.Element {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: SPACE.lg,
        padding: `${String(SPACE.xs)}px ${String(SPACE.md)}px`,
        borderTop: '1px solid var(--border-hairline)',
        fontSize: TEXT.micro,
        color: 'var(--text-secondary)',
        flexWrap: 'wrap',
      }}
    >
      {items.map(item => (
        <span key={item.id} style={{ display: 'inline-flex', gap: SPACE.xs }}>
          <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{item.value}</span>
        </span>
      ))}
      {children}
    </div>
  );
}
