import { type JSX } from 'react';
import { SPACE, TEXT, LABEL_STYLE, NUMERIC_STYLE, severityColor, type Severity } from './tokens.js';

export type Metric = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  /** Unit or qualifier printed under the figure, already translated. */
  readonly note?: string | undefined;
  readonly severity?: Severity | undefined;
};

type MetricRowProps = {
  readonly metrics: readonly Metric[];
};

/**
 * F5 — the instrument row. Figures are the point of this strip, so they
 * take the large size; everywhere else a number sits inside a sentence.
 */
export function MetricRow({ metrics }: MetricRowProps): JSX.Element {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))',
      gap: SPACE.sm,
    }}>
      {metrics.map((m) => (
        <div
          key={m.id}
          style={{
            background: 'var(--surface-panel)',
            border: '1px solid var(--border-hairline)',
            borderRadius: 6,
            padding: SPACE.md,
          }}
        >
          <div style={{ ...LABEL_STYLE, marginBottom: SPACE.xs }}>{m.label}</div>
          <div style={{
            ...NUMERIC_STYLE,
            fontSize: TEXT.title,
            fontWeight: 500,
            lineHeight: 1.1,
            color: m.severity === undefined ? 'var(--text-primary)' : severityColor(m.severity),
          }}>
            {m.value}
          </div>
          {m.note !== undefined && (
            <div style={{ fontSize: TEXT.micro, color: 'var(--text-muted)', marginTop: 2 }}>
              {m.note}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
