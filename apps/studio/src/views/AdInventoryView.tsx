import { type JSX, useMemo, useState } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import type { UiMessageKey } from '../i18n/messages.js';
import type { BookingState } from '../domain/ad-planning.js';
import { DEMO_BOOKINGS, DEMO_PLACEMENTS } from '../domain/demo/commerce.js';
import {
  DataTable, RegisterLayout, Inspector, InspectorEmpty, Tag, StateBanner, SPACE,
  type Column, type RegisterFilter, type Severity,
} from '../components/ui/index.js';
import { FindingList } from './message-schedule/FindingList.js';
import { inventoryRows, type InventoryRow } from './advertising/inventory-rows.js';
import { formatDay, formatNumber } from './register/format.js';

const ALL = 'all';
const WINDOW_MONTHS = 12;

const STATE_SEVERITY: Readonly<Record<BookingState, Severity>> = {
  free: 'valid',
  option: 'info',
  reserved: 'warning',
  occupied: 'warning',
  maintenance: 'blocking',
  retired: 'blocking',
};

/**
 * Module 05 — l'inventaire des emplacements publicitaires (H4.1), au gabarit
 * « registre ». Les emplacements ne sont pas encore au modèle de données :
 * l'écran tourne sur le jeu de démonstration, comme le planning, et le dit.
 * L'état, l'occupation et les conflits sont calculés depuis les réservations.
 */
export function AdInventoryView(): JSX.Element {
  const { t, lang } = useI18n();
  const today = new Date().toISOString().slice(0, 10);
  const [filter, setFilter] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo(
    () => inventoryRows(DEMO_PLACEMENTS, DEMO_BOOKINGS, today, WINDOW_MONTHS),
    [today],
  );
  const visible = filter === ALL ? rows : rows.filter(r => r.state === filter);
  const selected = rows.find(r => r.placement.id === selectedId) ?? visible[0] ?? null;

  const stateLabel = (s: BookingState): string => t(`ads.state.${s}` as UiMessageKey);
  const presentStates = [...new Set(rows.map(r => r.state))];
  const filters: readonly RegisterFilter[] = [
    { id: ALL, label: t('adinventory.filter.all') },
    ...presentStates.map(s => ({ id: s, label: stateLabel(s) })),
  ];
  const rate = (r: InventoryRow): string =>
    `${formatNumber((r.heldMonths / r.windowMonths) * 100, lang, 1)} %`;

  const columns: readonly Column<InventoryRow>[] = [
    { id: 'code', header: t('ads.col.placement'), cell: r => r.placement.id },
    { id: 'typology', header: t('ads.col.typology'), cell: r => r.placement.typology },
    { id: 'level', header: t('adinventory.col.level'), numeric: true, cell: r => String(r.placement.level_ordinal) },
    { id: 'area', header: t('ads.col.area'), numeric: true, cell: r => formatNumber(r.placement.area_m2, lang, 2) },
    { id: 'advertiser', header: t('ads.col.advertiser'), cell: r => r.placement.advertiser ?? '—' },
    {
      id: 'state',
      header: t('sitesheet.col.state'),
      cell: r => (r.conflicts.length > 0
        ? <Tag label={t('adinventory.state.conflict')} severity="blocking" />
        : <Tag label={stateLabel(r.state)} severity={STATE_SEVERITY[r.state]} />),
    },
    { id: 'rate', header: t('adinventory.col.rate'), numeric: true, cell: rate },
  ];

  const inspector = selected === null
    ? <InspectorEmpty text={t('adinventory.inspector.empty')} />
    : (
      <Inspector
        title={selected.placement.id}
        subtitle={t('adinventory.inspector.subtitle', {
          typology: selected.placement.typology,
          state: stateLabel(selected.state),
        })}
        sections={[
          {
            id: 'placement',
            title: t('adinventory.section.placement'),
            rows: [
              { id: 'typology', label: t('ads.col.typology'), value: selected.placement.typology },
              { id: 'level', label: t('adinventory.col.level'), value: String(selected.placement.level_ordinal) },
              { id: 'area', label: t('ads.col.area'), value: formatNumber(selected.placement.area_m2, lang, 2) },
              { id: 'advertiser', label: t('ads.col.advertiser'), value: selected.placement.advertiser ?? '—' },
            ],
          },
          {
            id: 'bookings',
            title: t('adinventory.section.bookings'),
            rows: selected.bookings.map(b => ({
              id: b.id,
              label: t('adinventory.booking.period', {
                from: formatDay(b.from_date, lang) ?? b.from_date,
                to: formatDay(b.to_date, lang) ?? b.to_date,
              }),
              value: stateLabel(b.state),
            })),
          },
          {
            id: 'computed',
            title: t('sitesheet.section.computed'),
            note: t('adinventory.section.computed.note', { months: WINDOW_MONTHS }),
            rows: [
              { id: 'rate', label: t('adinventory.col.rate'), value: rate(selected), computed: true },
              { id: 'held', label: t('adinventory.field.held'), value: `${String(selected.heldMonths)} / ${String(selected.windowMonths)}`, computed: true },
              { id: 'free', label: t('adinventory.field.firstfree'), value: selected.firstFree ?? t('adinventory.field.firstfree.none'), computed: true },
              { id: 'conflicts', label: t('adinventory.field.conflicts'), value: String(selected.conflicts.length), computed: true },
            ],
          },
        ]}
      >
        {selected.conflicts.length > 0 && (
          <section style={{ padding: '12px 16px' }}>
            <FindingList findings={selected.conflicts} empty="" />
          </section>
        )}
      </Inspector>
    );

  return (
    <div>
      <div style={{ marginBottom: SPACE.lg }}>
        <StateBanner severity="info" message={t('demo.dataset.message')} hint={t('demo.dataset.hint')} />
      </div>
      <RegisterLayout
        title={t('adinventory.title')}
        summary={t('adinventory.summary', { count: rows.length })}
        filtersLabel={t('register.filters')}
        filters={filters}
        filter={filter}
        onFilter={id => { setFilter(id); setSelectedId(null); }}
        shown={t('adinventory.shown', { count: visible.length })}
        inspector={inspector}
        note={t('adinventory.note')}
      >
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={r => r.placement.id}
          empty={t('adinventory.empty')}
          onSelect={r => { setSelectedId(r.placement.id); }}
          selectedKey={selected?.placement.id}
        />
      </RegisterLayout>
    </div>
  );
}
