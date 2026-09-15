import { type JSX, type ReactNode } from 'react';
import { PANEL_STYLE, PANEL_HEADER_STYLE, LABEL_STYLE, SPACE, TEXT } from './tokens.js';

type PanelProps = {
  readonly title: string;
  /** Right-hand note: a count, a version, a state. Already translated. */
  readonly note?: string | undefined;
  readonly padded?: boolean | undefined;
  readonly children: ReactNode;
};

/**
 * F1.3 — flat panel: a hairline border, no shadow, no hover elevation.
 * Border and fill say "separate object" and are spent once, here.
 */
export function Panel({ title, note, padded = true, children }: PanelProps): JSX.Element {
  return (
    <section style={PANEL_STYLE}>
      <header style={PANEL_HEADER_STYLE}>
        <h2 style={{ ...LABEL_STYLE, margin: 0 }}>{title}</h2>
        {note !== undefined && (
          <span style={{ fontSize: TEXT.micro, color: 'var(--text-muted)' }}>{note}</span>
        )}
      </header>
      <div style={{ padding: padded ? SPACE.md : 0, minWidth: 0 }}>
        {children}
      </div>
    </section>
  );
}

type PanelGridProps = {
  /** Minimum column width in pixels; columns wrap below it. */
  readonly min?: number | undefined;
  readonly children: ReactNode;
};

/** Panels laid out by the grid, never by per-element margins. */
export function PanelGrid({ min = 320, children }: PanelGridProps): JSX.Element {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${String(min)}px), 1fr))`,
      gap: SPACE.lg,
      alignItems: 'start',
    }}>
      {children}
    </div>
  );
}
