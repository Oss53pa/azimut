import { type JSX, useMemo, useState } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import { DEMO_LOTS, DEMO_RESERVES } from '../domain/demo/production.js';
import {
  DataTable, RegisterLayout, Inspector, InspectorEmpty, Tag, StateBanner, SPACE,
  type Column, type RegisterFilter,
} from '../components/ui/index.js';
import { lotRows, type LotRow } from './worksite/rows.js';
import { LOT_STATE_KEYS, LOT_STATE_SEVERITY } from './worksite/labels.js';

const ALL = 'all';

/**
 * Module 07 — l'allotissement (H6.2), au gabarit « registre » : un lot par
 * ligne, son fabricant, son état, et les réserves de pose qui l'empêchent
 * d'être déclaré posé. Jeu de démonstration, comme le reste du module.
 */
export function WorksiteLotsView(): JSX.Element {
  const { t } = useI18n();
  const [filter, setFilter] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rows = useMemo(() => lotRows(DEMO_LOTS, DEMO_RESERVES), []);

  const visible = filter === ALL ? rows : rows.filter(r => r.lot.state === filter);
  const selected = rows.find(r => r.lot.id === selectedId) ?? visible[0] ?? null;
  const states = [...new Set(rows.map(r => r.lot.state))];

  const filters: readonly RegisterFilter[] = [
    { id: ALL, label: t('worksitelots.filter.all') },
    ...states.map(s => ({ id: s, label: t(LOT_STATE_KEYS[s]) })),
  ];

  const columns: readonly Column<LotRow>[] = [
    { id: 'lot', header: t('worksite.col.lot'), cell: r => r.lot.id },
    { id: 'manufacturer', header: t('worksite.col.manufacturer'), cell: r => r.lot.manufacturer },
    { id: 'supports', header: t('worksite.col.supports'), numeric: true, cell: r => String(r.lot.support_count) },
    {
      id: 'state',
      header: t('worksite.col.state'),
      cell: r => <Tag label={t(LOT_STATE_KEYS[r.lot.state])} severity={LOT_STATE_SEVERITY[r.lot.state]} />,
    },
    {
      id: 'open',
      header: t('worksite.metric.reserves'),
      cell: r => (r.open === 0
        ? <Tag label={t('worksitelots.reserves.none')} severity="valid" />
        : <Tag label={String(r.open)} severity="warning" />),
    },
  ];

  const inspector = selected === null
    ? <InspectorEmpty text={t('worksitelots.inspector.empty')} />
    : (
      <Inspector
        title={selected.lot.id}
        subtitle={t('worksitelots.inspector.subtitle', {
          manufacturer: selected.lot.manufacturer,
          state: t(LOT_STATE_KEYS[selected.lot.state]),
        })}
        sections={[
          {
            id: 'reserves',
            title: t('worksite.panel.reserves'),
            rows: selected.reserves.map(r => ({
              id: r.record.reserve.id,
              label: t('worksitelots.reserve.label', { reserve: r.record.reserve.id, support: r.record.reserve.support_id }),
              value: r.finding === null ? t('worksite.reserve.lifted') : t('worksite.reserve.open'),
            })),
          },
          {
            id: 'computed',
            title: t('sitesheet.section.computed'),
            note: t('worksitelots.section.computed.note'),
            rows: [
              { id: 'supports', label: t('worksite.col.supports'), value: String(selected.lot.support_count), computed: true },
              { id: 'open', label: t('worksite.metric.reserves'), value: String(selected.open), computed: true },
              {
                id: 'ready',
                label: t('worksitelots.field.ready'),
                value: selected.open === 0 ? t('placement.point.yes') : t('placement.point.no'),
                computed: true,
              },
            ],
          },
        ]}
      />
    );

  return (
    <div>
      <div style={{ marginBottom: SPACE.lg }}>
        <StateBanner severity="info" message={t('demo.dataset.message')} hint={t('demo.dataset.hint')} />
      </div>
      <RegisterLayout
        title={t('worksite.panel.lots')}
        summary={t('worksitelots.summary', {
          lots: rows.length,
          supports: rows.reduce((n, r) => n + r.lot.support_count, 0),
        })}
        filtersLabel={t('register.filters')}
        filters={filters}
        filter={filter}
        onFilter={id => { setFilter(id); setSelectedId(null); }}
        shown={t('worksitelots.shown', { count: visible.length })}
        inspector={inspector}
        note={t('worksitelots.note')}
      >
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={r => r.lot.id}
          empty={t('worksite.lots.empty')}
          onSelect={r => { setSelectedId(r.lot.id); }}
          selectedKey={selected?.lot.id}
        />
      </RegisterLayout>
    </div>
  );
}
