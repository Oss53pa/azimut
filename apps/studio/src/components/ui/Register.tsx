import { type JSX, type ReactNode } from 'react';
import { SPACE, TEXT, LABEL_STYLE, NUMERIC_STYLE, PANEL_STYLE } from './tokens.js';

/**
 * Le gabarit « registre » de la maquette : une liste d'objets à gauche, filtrée
 * et sélectionnable, et l'inspecteur de l'objet choisi à droite. Le même
 * gabarit sert tous les écrans qui énumèrent des objets du site.
 */

export type RegisterFilter = {
  readonly id: string;
  readonly label: string;
};

type RegisterLayoutProps = {
  readonly title: string;
  /** Ce que la liste contient, déjà traduit : « 4 niveaux · 2 bâtiments ». */
  readonly summary: string;
  readonly filtersLabel: string;
  readonly filters: readonly RegisterFilter[];
  readonly filter: string;
  readonly onFilter: (id: string) => void;
  /** Compte des lignes affichées, déjà traduit. */
  readonly shown: string;
  readonly children: ReactNode;
  /** L'inspecteur, ou `null` quand rien n'est sélectionné. */
  readonly inspector: ReactNode;
  readonly note?: string | undefined;
};

export function RegisterLayout({
  title, summary, filtersLabel, filters, filter, onFilter, shown, children, inspector, note,
}: RegisterLayoutProps): JSX.Element {
  return (
    <section style={{ ...PANEL_STYLE, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px' }}>
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-hairline)' }}>
        <header style={{
          display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: SPACE.md,
          padding: '12px 16px', borderBottom: '1px solid var(--border-hairline)',
        }}>
          <h2 style={{ margin: 0, fontSize: TEXT.lead, fontWeight: 500 }}>{title}</h2>
          <span style={{ fontSize: TEXT.small, color: 'var(--text-muted)' }}>{summary}</span>
        </header>
        <div
          role="group"
          aria-label={filtersLabel}
          style={{
            display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: SPACE.xs,
            padding: '8px 16px', borderBottom: '1px solid var(--border-hairline)',
          }}
        >
          <span style={{ fontSize: TEXT.micro, color: 'var(--text-muted)', marginRight: SPACE.sm }}>
            {filtersLabel}
          </span>
          {filters.map(f => (
            <button
              key={f.id}
              type="button"
              aria-pressed={f.id === filter}
              onClick={() => { onFilter(f.id); }}
              style={{
                font: 'inherit', fontSize: TEXT.small, cursor: 'pointer',
                padding: '4px 8px', borderRadius: 4,
                border: `1px solid ${f.id === filter ? 'var(--border-interactive)' : 'transparent'}`,
                background: f.id === filter ? 'var(--surface-panel)' : 'transparent',
                color: f.id === filter ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              {f.label}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: TEXT.micro, color: 'var(--text-muted)' }}>{shown}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
        {note !== undefined && (
          <p style={{
            margin: 0, padding: '8px 16px', borderTop: '1px solid var(--border-hairline)',
            fontSize: TEXT.micro, color: 'var(--text-muted)',
          }}>
            {note}
          </p>
        )}
      </div>
      <aside style={{ minWidth: 0 }}>{inspector}</aside>
    </section>
  );
}

export type InspectorRow = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly unit?: string | undefined;
  /**
   * M7.10 (partie M) : une valeur calculée par le logiciel porte l'accent,
   * une valeur saisie reste neutre.
   */
  readonly computed?: boolean | undefined;
};

export type InspectorSection = {
  readonly id: string;
  readonly title: string;
  readonly rows: readonly InspectorRow[];
  readonly note?: string | undefined;
};

type InspectorProps = {
  readonly title: string;
  readonly subtitle: string;
  readonly sections: readonly InspectorSection[];
  readonly children?: ReactNode | undefined;
};

export function Inspector({ title, subtitle, sections, children }: InspectorProps): JSX.Element {
  return (
    <div>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-hairline)' }}>
        <div style={{ fontSize: TEXT.lead, fontWeight: 500 }}>{title}</div>
        <div style={{ fontSize: TEXT.small, color: 'var(--text-secondary)' }}>{subtitle}</div>
      </div>
      {sections.map(section => (
        <section key={section.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-hairline)' }}>
          <h3 style={{ ...LABEL_STYLE, margin: `0 0 ${String(SPACE.sm)}px` }}>{section.title}</h3>
          <dl style={{ margin: 0, display: 'grid', gap: SPACE.xs }}>
            {section.rows.map(row => (
              <div key={row.id} style={{ display: 'flex', alignItems: 'baseline', gap: SPACE.md }}>
                <dt style={{ flex: 1, fontSize: TEXT.small, color: 'var(--text-secondary)' }}>{row.label}</dt>
                <dd style={{
                  margin: 0, fontSize: TEXT.body, textAlign: 'right',
                  ...(row.computed === true ? { ...NUMERIC_STYLE, color: 'var(--accent)' } : {}),
                }}>
                  {row.value}
                  {row.unit !== undefined && (
                    <span style={{ fontSize: TEXT.micro, color: 'var(--text-muted)', marginLeft: SPACE.xs }}>
                      {row.unit}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          {section.note !== undefined && (
            <p style={{ margin: `${String(SPACE.sm)}px 0 0`, fontSize: TEXT.micro, color: 'var(--text-muted)' }}>
              {section.note}
            </p>
          )}
        </section>
      ))}
      {children}
    </div>
  );
}

/** Ce que l'inspecteur montre quand aucune ligne n'est choisie. */
export function InspectorEmpty({ text }: { readonly text: string }): JSX.Element {
  return (
    <p style={{ margin: 0, padding: SPACE.lg, fontSize: TEXT.small, color: 'var(--text-muted)' }}>{text}</p>
  );
}
