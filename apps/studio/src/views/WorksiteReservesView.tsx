import { type JSX, useMemo, useState } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import type { UiMessageKey } from '../i18n/messages.js';
import { DEMO_RESERVES } from '../domain/demo/production.js';
import {
  DataTable, RegisterLayout, Inspector, InspectorEmpty, Tag, StateBanner, SPACE,
  type Column, type RegisterFilter,
} from '../components/ui/index.js';
import { FindingList } from './message-schedule/FindingList.js';
import { reserveRows, type ReserveRow } from './worksite/rows.js';
import { formatDay } from './register/format.js';

const ALL = 'all';
const OPEN = 'open';
const LIFTED = 'lifted';

/**
 * Module 07 — les réserves de pose (H6.2), au gabarit « registre ». Une
 * réserve ouverte est relevée par le garde `auditInstallReserves` ; tant
 * qu'elle l'est, son support ne bascule pas en « posé ». Jeu de démonstration.
 */
export function WorksiteReservesView(): JSX.Element {
  const { t, lang } = useI18n();
  const [filter, setFilter] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rows = useMemo(() => reserveRows(DEMO_RESERVES), []);

  const visible = rows.filter(r => {
    if (filter === OPEN) return r.finding !== null;
    if (filter === LIFTED) return r.finding === null;
    return true;
  });
  const selected = rows.find(r => r.record.reserve.id === selectedId) ?? visible[0] ?? null;
  const open = rows.filter(r => r.finding !== null).length;

  const filters: readonly RegisterFilter[] = [
    { id: ALL, label: t('worksitereserves.filter.all') },
    { id: OPEN, label: t('worksitereserves.filter.open') },
    { id: LIFTED, label: t('worksitereserves.filter.lifted') },
  ];
  const observation = (r: ReserveRow): string => t(r.record.observation_key as UiMessageKey);

  const columns: readonly Column<ReserveRow>[] = [
    { id: 'reserve', header: t('worksite.col.reserve'), cell: r => r.record.reserve.id },
    { id: 'support', header: t('worksite.col.support'), cell: r => r.record.reserve.support_id },
    { id: 'lot', header: t('worksite.col.lot'), cell: r => r.record.lot_id },
    { id: 'observation', header: t('worksite.col.observation'), cell: observation },
    {
      id: 'state',
      header: t('worksite.col.state'),
      cell: r => (r.finding === null
        ? <Tag label={t('worksite.reserve.lifted')} severity="valid" />
        : <Tag label={t('worksite.reserve.open')} severity="warning" />),
    },
    { id: 'lifted', header: t('worksite.col.lifted'), cell: r => formatDay(r.record.lifted_on ?? undefined, lang) ?? '—' },
  ];

  const inspector = selected === null
    ? <InspectorEmpty text={t('worksitereserves.inspector.empty')} />
    : (
      <Inspector
        title={selected.record.reserve.id}
        subtitle={t('worksitereserves.inspector.subtitle', {
          support: selected.record.reserve.support_id,
          state: selected.finding === null ? t('worksite.reserve.lifted') : t('worksite.reserve.open'),
        })}
        sections={[
          {
            id: 'reserve',
            title: t('worksitereserves.section.reserve'),
            rows: [
              { id: 'lot', label: t('worksite.col.lot'), value: selected.record.lot_id },
              { id: 'observation', label: t('worksite.col.observation'), value: observation(selected) },
              { id: 'by', label: t('worksite.col.observedby'), value: selected.record.observed_by },
              { id: 'lifted', label: t('worksite.col.lifted'), value: formatDay(selected.record.lifted_on ?? undefined, lang) ?? '—' },
            ],
          },
        ]}
      >
        <section style={{ padding: '12px 16px' }}>
          <FindingList
            findings={selected.finding === null ? [] : [selected.finding]}
            empty={t('worksite.findings.empty')}
          />
        </section>
      </Inspector>
    );

  return (
    <div>
      <div style={{ marginBottom: SPACE.lg }}>
        <StateBanner severity="info" message={t('demo.dataset.message')} hint={t('demo.dataset.hint')} />
      </div>
      <RegisterLayout
        title={t('worksite.panel.reserves')}
        summary={t('worksitereserves.summary', { count: rows.length, open })}
        filtersLabel={t('register.filters')}
        filters={filters}
        filter={filter}
        onFilter={id => { setFilter(id); setSelectedId(null); }}
        shown={t('worksitereserves.shown', { count: visible.length })}
        inspector={inspector}
        note={t('worksite.note')}
      >
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={r => r.record.reserve.id}
          empty={t('worksite.reserves.empty')}
          onSelect={r => { setSelectedId(r.record.reserve.id); }}
          selectedKey={selected?.record.reserve.id}
        />
      </RegisterLayout>
    </div>
  );
}
