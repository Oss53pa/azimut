import { type JSX, type ReactNode } from 'react';
import { SPACE, TEXT, BUTTON_STYLE, PRIMARY_BUTTON_STYLE, LABEL_STYLE } from './tokens.js';

export type ScreenAction = {
  readonly id: string;
  readonly label: string;
  readonly primary?: boolean | undefined;
  readonly disabled?: boolean | undefined;
  readonly onSelect?: (() => void) | undefined;
};

type ScreenHeaderProps = {
  /** Short eyebrow — module number and state, already translated. */
  readonly eyebrow?: string | undefined;
  readonly title: string;
  /** Second-language title, shown small beside the first (D12). */
  readonly subtitle?: string | undefined;
  readonly actions?: readonly ScreenAction[] | undefined;
  readonly children?: ReactNode | undefined;
};

/**
 * F3 — the single title block every module screen opens with. The eyebrow
 * carries the module's place in the map (partie H), never decoration.
 */
export function ScreenHeader(
  { eyebrow, title, subtitle, actions, children }: ScreenHeaderProps,
): JSX.Element {
  return (
    <div style={{ marginBottom: SPACE.lg }}>
      {eyebrow !== undefined && (
        <div style={{ ...LABEL_STYLE, marginBottom: SPACE.xs }}>{eyebrow}</div>
      )}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        flexWrap: 'wrap',
        gap: SPACE.md,
      }}>
        <h1 style={{
          margin: 0,
          fontSize: TEXT.title,
          fontWeight: 500,
          color: 'var(--text-primary)',
          textWrap: 'balance',
        }}>
          {title}
        </h1>
        {subtitle !== undefined && (
          <span style={{ fontSize: TEXT.body, color: 'var(--text-muted)' }}>
            {subtitle}
          </span>
        )}
        <div style={{ flex: 1, minWidth: SPACE.lg }} />
        {actions?.map((action) => (
          <button
            key={action.id}
            type="button"
            disabled={action.disabled === true}
            onClick={action.onSelect}
            style={{
              ...(action.primary === true ? PRIMARY_BUTTON_STYLE : BUTTON_STYLE),
              opacity: action.disabled === true ? 0.45 : 1,
              cursor: action.disabled === true ? 'not-allowed' : 'pointer',
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
      {children !== undefined && (
        <div style={{ marginTop: SPACE.sm }}>{children}</div>
      )}
    </div>
  );
}
