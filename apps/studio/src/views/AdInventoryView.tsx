import { type JSX, useMemo, useState } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import type { UiMessageKey } from '../i18n/messages.js';
import type { BookingState } from '../domain/ad-planning.js';
import { useSiteData } from '../context/useSiteData.js';
import { EMPTY_ADVERTISING_DATA, loadAdvertising, useRegistry } from '../data/index.js';
import {
  DataTable, RegisterLayout, Inspector, InspectorEmpty, Tag,
  type Column, type RegisterFilter, type Severity,
} from '../components/ui/index.js';
import { RegistryStatus } from './register/RegistryStatus.js';
import { siteLabels } from './register/labels.js';
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
 * « registre ». Les emplacements se lisent en base (0045), ou dans le jeu de
 * démonstration du dépôt de référence. L'état, l'occupation, l'annonceur et
 * les conflits sont calculés depuis les réservations.
 */
type AdInventoryViewProps = {
  /** Clé du site dans le dépôt, celle dont la coquille l'a chargé. */
  readonly siteKey: string;
};

export function AdInventoryView({ siteKey }: AdInventoryViewProps): JSX.Element {
  const site = useSiteData();
  const { t, lang } = useI18n();
  const state = useRegistry(loadAdvertising, EMPTY_ADVERTISING_DATA, siteKey);
  const labels = useMemo(() => siteLabels(site, lang), [site, lang]);
  const { placements, bookings } = state.registry.registry;
  const today = new Date().toISOString().slice(0, 10);
  const [filter, setFilter] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo(
    () => inventoryRows(placements, bookings, today, WINDOW_MONTHS),
    [placements, bookings, today],
  );

  if (state.status !== 'ready') return <RegistryStatus state={state} />;
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
    { id: 'code', header: t('ads.col.placement'), cell: r => r.placement.code },
    { id: 'typology', header: t('ads.col.typology'), cell: r => r.placement.typology_key },
    { id: 'level', header: t('adinventory.col.level'), cell: r => labels.level(r.placement.level_id) },
    { id: 'area', header: t('ads.col.area'), numeric: true, cell: r => formatNumber(r.placement.area_m2, lang, 2) },
    { id: 'advertiser', header: t('ads.col.advertiser'), cell: r => r.advertiser ?? '—' },
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
        title={selected.placement.code}
        subtitle={t('adinventory.inspector.subtitle', {
          typology: selected.placement.typology_key,
          state: stateLabel(selected.state),
        })}
        sections={[
          {
            id: 'placement',
            title: t('adinventory.section.placement'),
            rows: [
              { id: 'typology', label: t('ads.col.typology'), value: selected.placement.typology_key },
              { id: 'level', label: t('adinventory.col.level'), value: labels.level(selected.placement.level_id) },
              { id: 'area', label: t('ads.col.area'), value: formatNumber(selected.placement.area_m2, lang, 2) },
              { id: 'advertiser', label: t('ads.col.advertiser'), value: selected.advertiser ?? '—' },
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
      <RegistryStatus state={state} />
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
