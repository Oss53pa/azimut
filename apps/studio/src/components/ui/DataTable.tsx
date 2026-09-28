import { type JSX, type ReactNode } from 'react';
import { SPACE, TEXT, LABEL_STYLE, NUMERIC_STYLE } from './tokens.js';

export type Column<Row> = {
  readonly id: string;
  readonly header: string;
  /** Right-aligned, tabular figures. Use for every quantity. */
  readonly numeric?: boolean | undefined;
  readonly cell: (row: Row) => ReactNode;
};

type DataTableProps<Row> = {
  readonly columns: readonly Column<Row>[];
  readonly rows: readonly Row[];
  readonly rowKey: (row: Row) => string;
  /** Shown in place of the table when there is nothing to list. */
  readonly empty: string;
  readonly caption?: string | undefined;
  readonly onSelect?: ((row: Row) => void) | undefined;
  readonly selectedKey?: string | undefined;
};

const CELL_STYLE: React.CSSProperties = {
  padding: '8px 12px',
  borderBottom: '1px solid var(--border-hairline)',
  fontSize: TEXT.small,
  color: 'var(--text-primary)',
  verticalAlign: 'top',
};

/**
 * The one table of the product. Wide tables scroll inside their own
 * container so the page body never scrolls sideways.
 */
export function DataTable<Row>(
  { columns, rows, rowKey, empty, caption, onSelect, selectedKey }: DataTableProps<Row>,
): JSX.Element {
  if (rows.length === 0) {
    return (
      <p style={{ margin: 0, padding: SPACE.md, fontSize: TEXT.small, color: 'var(--text-muted)' }}>
        {empty}
      </p>
    );
  }

  return (
    <div style={{ overflowX: 'auto', minWidth: 0 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 'max-content' }}>
        {caption !== undefined && (
          <caption style={{ ...LABEL_STYLE, textAlign: 'left', padding: '0 12px 6px' }}>
            {caption}
          </caption>
        )}
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.id}
                scope="col"
                style={{
                  ...LABEL_STYLE,
                  textAlign: c.numeric === true ? 'right' : 'left',
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--border-strong)',
                  whiteSpace: 'nowrap',
                }}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row);
            const selected = key === selectedKey;
            return (
              <tr
                key={key}
                onClick={onSelect === undefined ? undefined : () => { onSelect(row); }}
                // Une ligne sélectionnable se choisit aussi au clavier.
                tabIndex={onSelect === undefined ? undefined : 0}
                aria-selected={onSelect === undefined ? undefined : selected}
                onKeyDown={onSelect === undefined ? undefined : (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(row);
                  }
                }}
                style={{
                  background: selected ? 'var(--surface-sunken)' : 'transparent',
                  cursor: onSelect === undefined ? 'default' : 'pointer',
                }}
              >
                {columns.map((c) => (
                  <td
                    key={c.id}
                    style={{
                      ...CELL_STYLE,
                      ...(c.numeric === true
                        ? { ...NUMERIC_STYLE, textAlign: 'right' as const }
                        : {}),
                    }}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
