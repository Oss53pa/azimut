import { type JSX, useState } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import { DEMO_INSTALL_SLOTS, type InstallSlot } from '../domain/demo/production.js';
import {
  DataTable, RegisterLayout, Inspector, InspectorEmpty, Tag, StateBanner, SPACE,
  type Column, type RegisterFilter,
} from '../components/ui/index.js';
import { formatDay } from './register/format.js';

const ALL = 'all';
const PLANNED = 'planned';
const UNPLANNED = 'unplanned';

/**
 * Module 07 — le planning de pose (H6.2), au gabarit « registre » : un
 * créneau par ligne, sa zone, ses supports, jour ou nuit, et les poses qui
 * attendent encore une date. Jeu de démonstration.
 */
export function WorksiteSlotsView(): JSX.Element {
  const { t, lang } = useI18n();
  const [filter, setFilter] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rows = [...DEMO_INSTALL_SLOTS].sort((a, b) =>
    (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.id.localeCompare(b.id));

  const visible = rows.filter(s => {
    if (filter === PLANNED) return s.date !== null;
    if (filter === UNPLANNED) return s.date === null;
    return true;
  });
  const selected = rows.find(s => s.id === selectedId) ?? visible[0] ?? null;
  const planned = rows.filter(s => s.date !== null);

  const filters: readonly RegisterFilter[] = [
    { id: ALL, label: t('worksiteslots.filter.all') },
    { id: PLANNED, label: t('worksiteslots.filter.planned') },
    { id: UNPLANNED, label: t('worksiteslots.filter.unplanned') },
  ];
  const shift = (s: InstallSlot): string => (s.night_work ? t('worksite.shift.night') : t('worksite.shift.day'));

  const columns: readonly Column<InstallSlot>[] = [
    { id: 'slot', header: t('worksiteslots.col.slot'), cell: s => s.id },
    { id: 'zone', header: t('worksite.col.zone'), cell: s => s.zone },
    { id: 'supports', header: t('worksite.col.supports'), numeric: true, cell: s => String(s.support_count) },
    { id: 'shift', header: t('worksite.col.shift'), cell: shift },
    {
      id: 'state',
      header: t('worksite.col.state'),
      cell: s => (s.date === null
        ? <Tag label={t('worksite.slot.unplanned')} severity="warning" />
        : <Tag label={t('worksiteslots.state.planned')} severity="valid" />),
    },
    { id: 'date', header: t('worksite.col.date'), cell: s => formatDay(s.date ?? undefined, lang) ?? '—' },
  ];

  const inspector = selected === null
    ? <InspectorEmpty text={t('worksiteslots.inspector.empty')} />
    : (
      <Inspector
        title={selected.id}
        subtitle={t('worksiteslots.inspector.subtitle', { zone: selected.zone, shift: shift(selected) })}
        sections={[
          {
            id: 'slot',
            title: t('worksiteslots.section.slot'),
            rows: [
              { id: 'zone', label: t('worksite.col.zone'), value: selected.zone },
              { id: 'date', label: t('worksite.col.date'), value: formatDay(selected.date ?? undefined, lang) ?? t('worksite.slot.unplanned') },
              { id: 'shift', label: t('worksite.col.shift'), value: shift(selected) },
            ],
          },
          {
            id: 'computed',
            title: t('sitesheet.section.computed'),
            rows: [
              { id: 'supports', label: t('worksite.col.supports'), value: String(selected.support_count), computed: true },
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
        title={t('worksite.panel.slots')}
        summary={t('worksiteslots.summary', {
          count: rows.length,
          planned: planned.reduce((n, s) => n + s.support_count, 0),
          unplanned: rows.filter(s => s.date === null).reduce((n, s) => n + s.support_count, 0),
        })}
        filtersLabel={t('register.filters')}
        filters={filters}
        filter={filter}
        onFilter={id => { setFilter(id); setSelectedId(null); }}
        shown={t('worksiteslots.shown', { count: visible.length })}
        inspector={inspector}
        note={t('worksiteslots.note')}
      >
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={s => s.id}
          empty={t('worksite.slots.empty')}
          onSelect={s => { setSelectedId(s.id); }}
          selectedKey={selected?.id}
        />
      </RegisterLayout>
    </div>
  );
}
