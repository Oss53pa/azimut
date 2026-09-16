import { type JSX } from 'react';
import type { MessageLine } from '@azimut/engine-graph';
import { useI18n } from '../../i18n/useI18n.js';
import { DataTable, Tag, type Column } from '../../components/ui/index.js';

type ScheduleTableProps = {
  readonly lines: readonly MessageLine[];
};

/** Texte d'une ligne dans une langue : les mentions, dans l'ordre du bloc. */
function lineText(line: MessageLine, lang: string): string {
  return line.entries
    .map(e => e.text[lang] ?? '')
    .filter(text => text.length > 0)
    .join(' · ');
}

const EMPTY_CELL = '—';

function orEmpty(value: string | null): string {
  return value === null || value.length === 0 ? EMPTY_CELL : value;
}

/**
 * H11 — une ligne du tableau par bloc résolu. Les deux langues sont côte à
 * côte : c'est ainsi que la maîtrise d'ouvrage valide (D12.2).
 */
export function ScheduleTable({ lines }: ScheduleTableProps): JSX.Element {
  const { t } = useI18n();

  const columns: readonly Column<MessageLine>[] = [
    { id: 'id', header: t('schedule.col.line'), cell: l => l.id },
    {
      id: 'position',
      header: t('schedule.col.position'),
      cell: l => `${l.support_id} · F${String(l.face_index + 1)} · b${String(l.block_index + 1)}`,
    },
    { id: 'fr', header: t('schedule.col.fr'), cell: l => orEmpty(lineText(l, 'fr')) },
    { id: 'en', header: t('schedule.col.en'), cell: l => orEmpty(lineText(l, 'en')) },
    { id: 'picto', header: t('schedule.col.pictogram'), cell: l => orEmpty(l.pictogram_id) },
    { id: 'dir', header: t('schedule.col.direction'), cell: l => orEmpty(l.direction) },
    {
      id: 'level',
      header: t('schedule.col.level'),
      numeric: true,
      cell: l => (l.information_level === null ? EMPTY_CELL : String(l.information_level)),
    },
    {
      id: 'point',
      header: t('schedule.col.decisionpoint'),
      cell: l => l.decision_point_id,
    },
    {
      id: 'state',
      header: t('schedule.col.state'),
      cell: l => (
        <Tag
          label={l.stale ? t('schedule.state.stale') : t('schedule.state.current')}
          severity={l.stale ? 'warning' : 'valid'}
        />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={lines}
      rowKey={l => l.id}
      empty={t('schedule.table.empty')}
    />
  );
}
