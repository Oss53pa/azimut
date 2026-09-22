import { type JSX, type KeyboardEvent } from 'react';
import { Tag, SPACE, TEXT, LABEL_STYLE, NUMERIC_STYLE } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import type { UiMessageKey } from '../../i18n/index.js';
import type { LineState, RowGroup, ScheduleRow } from '../../state/message-schedule-rows.js';

/**
 * R3, R5, R10 et R17 (partie R) — le tableau lui-même.
 *
 * **Aucune cellule n'est éditable, par aucune voie.** Règle M02.W6, critère 2
 * de R18 : le tableau ne porte ni champ de saisie, ni élément modifiable, ni
 * gestionnaire de collage. Une ligne fausse se corrige à sa source, que le
 * panneau de détail nomme.
 *
 * R17 : « Indicateur de focus sur la ligne, distinct de l'indicateur de
 * sélection. » Les deux sont portés séparément — un filet à gauche pour le
 * focus, un fond pour la sélection — et la ligne focalisée porte
 * `aria-selected` seulement quand elle est aussi sélectionnée.
 */
export type LineTableProps = {
  readonly groups: readonly RowGroup[];
  /** Langues actives du site. R5 (partie R) : elles seules ont une colonne. */
  readonly langs: readonly string[];
  readonly focusedId: string | null;
  readonly selectedIds: readonly string[];
  readonly onFocusRow: (id: string) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  readonly emptyLabel: string;
  readonly tableId: string;
};

const STATE_KEYS: Readonly<Record<LineState, UiMessageKey>> = {
  current: 'msgtable.linestate.current',
  stale: 'msgtable.linestate.stale',
  blocking: 'msgtable.linestate.blocking',
  excluded: 'msgtable.linestate.excluded',
};

const LEVEL_KEYS: Readonly<Record<number, UiMessageKey>> = {
  1: 'msgtable.level.1',
  2: 'msgtable.level.2',
  3: 'msgtable.level.3',
  4: 'msgtable.level.4',
};

const DIRECTION_KEYS: Readonly<Record<string, UiMessageKey>> = {
  left: 'msgtable.direction.left',
  right: 'msgtable.direction.right',
  ahead: 'msgtable.direction.ahead',
  up: 'msgtable.direction.up',
  down: 'msgtable.direction.down',
  back: 'msgtable.direction.back',
};

export function LineTable(props: LineTableProps): JSX.Element {
  const { t } = useI18n();
  const total = props.groups.reduce((n, group) => n + group.rows.length, 0);

  if (total === 0) {
    return (
      <p style={{ margin: 0, padding: SPACE.md, fontSize: TEXT.small, color: 'var(--text-muted)' }}>
        {props.emptyLabel}
      </p>
    );
  }

  /**
   * R17 (partie R) : « Tableau pilotable entièrement au clavier. »
   *
   * Une seule ligne est atteignable à la tabulation, et le focus se déplace
   * ensuite aux flèches. Tant qu'aucune ligne n'est focalisée, c'est la
   * première : sans elle, aucune ligne ne porterait `tabIndex` à zéro et le
   * tableau serait hors d'atteinte du clavier.
   */
  const rovingId = props.focusedId
    ?? props.groups.flatMap(group => group.rows)[0]?.line.id
    ?? null;

  const columns = [
    t('msgtable.column.stable_id'),
    t('msgtable.column.support'),
    t('msgtable.column.face'),
    t('msgtable.column.block'),
    ...props.langs.map(lang => t('msgtable.column.content', { lang: lang.toUpperCase() })),
    t('msgtable.column.pictogram'),
    t('msgtable.column.direction'),
    t('msgtable.column.information_level'),
    t('msgtable.column.decision_point'),
    t('msgtable.column.state'),
  ];

  return (
    <div
      id={props.tableId}
      onKeyDown={props.onKeyDown}
      style={{ overflowX: 'auto', minWidth: 0 }}
    >
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 'max-content' }}>
        <caption style={{ ...LABEL_STYLE, textAlign: 'left', padding: '0 12px 6px' }}>
          {t('msgtable.table.caption')}
        </caption>
        <thead>
          <tr>
            {columns.map(header => (
              <th key={header} scope="col" style={headerStyle}>{header}</th>
            ))}
          </tr>
        </thead>
        {props.groups.map(group => (
          <tbody key={group.key}>
            {/* R6.1 (partie R) — l'en-tête rappelle le groupe et son compte. */}
            <tr>
              {/* L'en-tête coiffe le groupe de lignes qui suit, pas une
                  colonne : `rowgroup` est la portée que cette place appelle. */}
              <th scope="rowgroup" colSpan={columns.length} style={groupStyle}>
                {`${group.heading ?? t('msgtable.group.unattached')} · ${t('msgtable.group.count', { count: group.rows.length })}`}
              </th>
            </tr>
            {group.rows.map(row => (
              <Row
                key={row.line.id}
                row={row}
                langs={props.langs}
                focused={props.focusedId === row.line.id}
                tabbable={row.line.id === rovingId}
                selected={props.selectedIds.includes(row.line.id)}
                onFocusRow={props.onFocusRow}
              />
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function Row({ row, langs, focused, tabbable, selected, onFocusRow }: {
  readonly row: ScheduleRow;
  readonly langs: readonly string[];
  readonly focused: boolean;
  /** La ligne qu'atteint la tabulation. Une seule à la fois. */
  readonly tabbable: boolean;
  readonly selected: boolean;
  readonly onFocusRow: (id: string) => void;
}): JSX.Element {
  const { t } = useI18n();
  const { line } = row;
  // R9 : une ligne écartée s'affiche en `text-muted`, avec son libellé.
  const muted = row.state === 'excluded';

  return (
    <tr
      tabIndex={tabbable ? 0 : -1}
      aria-selected={selected}
      onFocus={() => { onFocusRow(line.id); }}
      onClick={() => { onFocusRow(line.id); }}
      style={{
        // R17 : le focus et la sélection se distinguent, et aucun des deux
        // n'est porté par la seule couleur.
        borderLeft: focused ? '3px solid var(--text-primary)' : '3px solid transparent',
        background: selected ? 'var(--surface-sunken)' : 'transparent',
        color: muted ? 'var(--text-muted)' : 'var(--text-primary)',
      }}
    >
      <td style={{ ...cellStyle, ...NUMERIC_STYLE }}>
        {row.stableId ?? <Marked label={t('msgtable.cell.no_support_code')} />}
      </td>
      <td style={cellStyle}>{row.supportCode ?? line.support_id}</td>
      <td style={{ ...cellStyle, ...NUMERIC_STYLE, textAlign: 'right' }}>{line.face_index}</td>
      <td style={{ ...cellStyle, ...NUMERIC_STYLE, textAlign: 'right' }}>{line.block_index}</td>

      {langs.map(lang => (
        <td key={lang} style={cellStyle}>
          <LangCell row={row} lang={lang} />
        </td>
      ))}

      <td style={cellStyle}>{line.pictogram_id ?? t('msgtable.cell.no_pictogram')}</td>
      <td style={cellStyle}>
        {/* R5 (partie R) : symbole et libellé, jamais le seul symbole. */}
        {line.direction === null
          ? t('msgtable.cell.no_direction')
          : t(DIRECTION_KEYS[line.direction] ?? 'msgtable.cell.no_direction')}
      </td>
      <td style={cellStyle}>
        {line.information_level === null
          ? ''
          : t(LEVEL_KEYS[line.information_level] ?? 'msgtable.level.1')}
      </td>
      <td style={{ ...cellStyle, ...NUMERIC_STYLE }}>{line.decision_point_id}</td>
      <td style={cellStyle}>
        <Tag
          label={t(STATE_KEYS[row.state])}
          severity={severityOf(row.state)}
          muted={row.state === 'excluded'}
        />
      </td>
    </tr>
  );
}

/**
 * R5 (partie R) : « Une langue active sans contenu pour une ligne affiche une
 * cellule vide marquée, jamais une cellule vide muette. »
 */
function LangCell({ row, lang }: {
  readonly row: ScheduleRow;
  readonly lang: string;
}): JSX.Element {
  const { t } = useI18n();
  const written = row.line.entries
    .map(entry => entry.text[lang] ?? '')
    .filter(text => text !== '');

  if (written.length === 0) {
    return <Marked label={t('msgtable.cell.lang_missing')} />;
  }
  // R5 (partie R) : le contenu n'est jamais tronqué sans indication ; la
  // cellule passe à la ligne et la hauteur de ligne s'adapte.
  return <span style={{ whiteSpace: 'pre-wrap' }}>{written.join('\n')}</span>;
}

function Marked({ label }: { readonly label: string }): JSX.Element {
  return (
    <span
      title={label}
      style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: TEXT.micro }}
    >
      {label}
    </span>
  );
}

function severityOf(state: LineState): 'blocking' | 'warning' | undefined {
  if (state === 'blocking') return 'blocking';
  if (state === 'stale') return 'warning';
  return undefined;
}

const headerStyle: React.CSSProperties = {
  ...LABEL_STYLE,
  textAlign: 'left',
  padding: '8px 12px',
  borderBottom: '1px solid var(--border-strong)',
  whiteSpace: 'nowrap',
};

const groupStyle: React.CSSProperties = {
  ...LABEL_STYLE,
  textAlign: 'left',
  padding: '8px 12px 4px',
  background: 'var(--surface-sunken)',
  borderBottom: '1px solid var(--border-hairline)',
};

const cellStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderBottom: '1px solid var(--border-hairline)',
  fontSize: TEXT.small,
  verticalAlign: 'top',
};
