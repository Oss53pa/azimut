import { type JSX, useMemo, useState } from 'react';
import { WORK_ORDER_STATES, type WorkOrder, type WorkOrderState } from '@azimut/core-model';
import { useI18n } from '../i18n/useI18n.js';
import { appRepository, useMaintenanceRegistryLoad } from '../data/index.js';
import {
  DataTable, RegisterLayout, Inspector, InspectorEmpty, Tag,
  type Column, type RegisterFilter, type Severity,
} from '../components/ui/index.js';
import { jsonText } from './operations/fleet-rows.js';
import { MaintenanceBanner } from './operations/MaintenanceBanner.js';
import { formatDay } from './register/format.js';
import { formatMoney } from './budget/money.js';

const ALL = 'all';
const EMPTY = '—';
/** Longueur de la référence affichée : le début de l'identifiant, rien de calculé. */
const REF_LENGTH = 8;

const STATE_SEVERITY: Readonly<Record<WorkOrderState, Severity>> = {
  draft: 'info',
  issued: 'warning',
  in_progress: 'warning',
  done: 'valid',
  cancelled: 'blocking',
};

type OpsWorkOrdersViewProps = {
  /** Clé du site dans le dépôt, celle dont la coquille l'a chargé. */
  readonly siteKey: string;
};

/**
 * Module 08 — les ordres de travaux (A5.7), au gabarit « registre », lus en
 * base. Un ordre naît d'une décision humaine (E3) : l'écran n'en crée ni n'en
 * fait avancer aucun. Le coût est en unité mineure avec sa devise (H8).
 */
export function OpsWorkOrdersView({ siteKey }: OpsWorkOrdersViewProps): JSX.Element {
  const { t, lang } = useI18n();
  const repository = useMemo(() => appRepository(), []);
  const state = useMaintenanceRegistryLoad(repository, siteKey);
  const [filter, setFilter] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const orders = state.registry.work_orders;
  const banner = (
    <MaintenanceBanner state={state} empty={orders.length === 0} emptyMessage={t('workorders.empty.registry')} />
  );
  if (state.status !== 'ready') return <div>{banner}</div>;

  const day = (iso: string | null): string => (iso === null ? EMPTY : formatDay(iso.slice(0, 10), lang) ?? iso);
  const cost = (o: WorkOrder): string => formatMoney(o.estimated_cost, lang, t('workorders.cost.none'));
  const stateLabel = (s: WorkOrderState): string => t(`workorders.state.${s}`);
  const ref = (o: WorkOrder): string => o.id.slice(0, REF_LENGTH);

  const visible = filter === ALL ? orders : orders.filter(o => o.state === filter);
  const selected = orders.find(o => o.id === selectedId) ?? visible[0] ?? null;
  const present = WORK_ORDER_STATES.filter(s => orders.some(o => o.state === s));

  const filters: readonly RegisterFilter[] = [
    { id: ALL, label: t('workorders.filter.all') },
    ...present.map(s => ({ id: s, label: stateLabel(s) })),
  ];

  const columns: readonly Column<WorkOrder>[] = [
    { id: 'ref', header: t('workorders.col.ref'), cell: ref },
    { id: 'state', header: t('workorders.col.state'), cell: o => <Tag label={stateLabel(o.state)} severity={STATE_SEVERITY[o.state]} /> },
    { id: 'created', header: t('workorders.col.created'), cell: o => day(o.created_at) },
    { id: 'closed', header: t('workorders.col.closed'), cell: o => day(o.closed_at) },
    { id: 'cost', header: t('workorders.col.cost'), numeric: true, cell: cost },
    { id: 'scope', header: t('workorders.col.scope'), cell: o => jsonText(o.scope) || EMPTY },
  ];

  const inspector = selected === null
    ? <InspectorEmpty text={t('workorders.inspector.empty')} />
    : (
      <Inspector
        title={ref(selected)}
        subtitle={t('workorders.inspector.subtitle', { state: stateLabel(selected.state), date: day(selected.created_at) })}
        sections={[
          {
            id: 'order',
            title: t('workorders.section.order'),
            rows: [
              { id: 'state', label: t('workorders.col.state'), value: stateLabel(selected.state) },
              { id: 'created', label: t('workorders.col.created'), value: day(selected.created_at) },
              { id: 'closed', label: t('workorders.col.closed'), value: day(selected.closed_at) },
              { id: 'scope', label: t('workorders.col.scope'), value: jsonText(selected.scope) || EMPTY },
            ],
          },
          {
            id: 'cost',
            title: t('workorders.col.cost'),
            note: t('workorders.section.cost.note'),
            rows: [
              { id: 'cost', label: t('workorders.col.cost'), value: cost(selected) },
              { id: 'currency', label: t('workorders.field.currency'), value: selected.estimated_cost?.currency ?? '—' },
            ],
          },
        ]}
      />
    );

  return (
    <div>
      {banner}
      <RegisterLayout
        title={t('workorders.title')}
        summary={t('workorders.summary', {
          count: orders.length,
          active: orders.filter(o => o.state === 'issued' || o.state === 'in_progress').length,
        })}
        filtersLabel={t('register.filters')}
        filters={filters}
        filter={filter}
        onFilter={id => { setFilter(id); setSelectedId(null); }}
        shown={t('workorders.shown', { count: visible.length })}
        inspector={inspector}
        note={t('workorders.note')}
      >
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={o => o.id}
          empty={t('workorders.empty')}
          onSelect={o => { setSelectedId(o.id); }}
          selectedKey={selected?.id}
        />
      </RegisterLayout>
    </div>
  );
}
