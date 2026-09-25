import { type JSX, useMemo, useState } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import { EMPTY_WORKSITE_REGISTRY } from '@azimut/core-model';
import { useSiteData } from '../context/useSiteData.js';
import { loadWorksite, useRegistry } from '../data/index.js';
import {
  DataTable, RegisterLayout, Inspector, InspectorEmpty, Tag,
  type Column, type RegisterFilter,
} from '../components/ui/index.js';
import { RegistryStatus } from './register/RegistryStatus.js';
import { observationKey } from './worksite/labels.js';
import { FindingList } from './message-schedule/FindingList.js';
import { reserveRows, type ReserveRow } from './worksite/rows.js';
import { formatDay } from './register/format.js';

const ALL = 'all';
const OPEN = 'open';
const LIFTED = 'lifted';

/**
 * Module 07 — les réserves de pose (H6.2), au gabarit « registre ». Une
 * réserve ouverte est relevée par le garde `auditInstallReserves` ; tant
 * qu'elle l'est, son support ne bascule pas en « posé ». Lu en base (0042),
 * ou dans le jeu de démonstration du dépôt de référence.
 */
type WorksiteReservesViewProps = {
  /** Clé du site dans le dépôt, celle dont la coquille l'a chargé. */
  readonly siteKey: string;
};

export function WorksiteReservesView({ siteKey }: WorksiteReservesViewProps): JSX.Element {
  const site = useSiteData();
  const { t, lang } = useI18n();
  const state = useRegistry(loadWorksite, EMPTY_WORKSITE_REGISTRY, siteKey);
  const [filter, setFilter] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rows = useMemo(() => reserveRows(state.registry.reserves), [state.registry]);
  const lotCodes = useMemo(() => new Map(state.registry.lots.map(l => [l.id, l.code])), [state.registry]);
  const supportCodes = useMemo(() => new Map(site.supports.map(s => [s.id, s.code ?? s.id])), [site]);

  if (state.status !== 'ready') return <RegistryStatus state={state} />;

  const visible = rows.filter(r => {
    if (filter === OPEN) return r.finding !== null;
    if (filter === LIFTED) return r.finding === null;
    return true;
  });
  const selected = rows.find(r => r.reserve.id === selectedId) ?? visible[0] ?? null;
  const open = rows.filter(r => r.finding !== null).length;

  const filters: readonly RegisterFilter[] = [
    { id: ALL, label: t('worksitereserves.filter.all') },
    { id: OPEN, label: t('worksitereserves.filter.open') },
    { id: LIFTED, label: t('worksitereserves.filter.lifted') },
  ];
  const observation = (r: ReserveRow): string => {
    const key = observationKey(r.reserve.observation_key);
    return key === null ? r.reserve.observation_key : t(key);
  };
  const lot = (r: ReserveRow): string => lotCodes.get(r.reserve.lot_id) ?? r.reserve.lot_id;
  const support = (r: ReserveRow): string => supportCodes.get(r.reserve.support_id) ?? r.reserve.support_id;
  const lifted = (r: ReserveRow): string =>
    (r.reserve.lifted_at === null ? '—' : formatDay(r.reserve.lifted_at.slice(0, 10), lang) ?? r.reserve.lifted_at);

  const columns: readonly Column<ReserveRow>[] = [
    { id: 'reserve', header: t('worksite.col.reserve'), cell: r => r.reserve.id },
    { id: 'support', header: t('worksite.col.support'), cell: support },
    { id: 'lot', header: t('worksite.col.lot'), cell: lot },
    { id: 'observation', header: t('worksite.col.observation'), cell: observation },
    {
      id: 'state',
      header: t('worksite.col.state'),
      cell: r => (r.finding === null
        ? <Tag label={t('worksite.reserve.lifted')} severity="valid" />
        : <Tag label={t('worksite.reserve.open')} severity="warning" />),
    },
    { id: 'lifted', header: t('worksite.col.lifted'), cell: lifted },
  ];

  const inspector = selected === null
    ? <InspectorEmpty text={t('worksitereserves.inspector.empty')} />
    : (
      <Inspector
        title={selected.reserve.id}
        subtitle={t('worksitereserves.inspector.subtitle', {
          support: support(selected),
          state: selected.finding === null ? t('worksite.reserve.lifted') : t('worksite.reserve.open'),
        })}
        sections={[
          {
            id: 'reserve',
            title: t('worksitereserves.section.reserve'),
            rows: [
              { id: 'lot', label: t('worksite.col.lot'), value: lot(selected) },
              { id: 'observation', label: t('worksite.col.observation'), value: observation(selected) },
              { id: 'by', label: t('worksite.col.observedby'), value: selected.reserve.observed_by },
              { id: 'lifted', label: t('worksite.col.lifted'), value: lifted(selected) },
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
      <RegistryStatus state={state} />
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
          rowKey={r => r.reserve.id}
          empty={t('worksite.reserves.empty')}
          onSelect={r => { setSelectedId(r.reserve.id); }}
          selectedKey={selected?.reserve.id}
        />
      </RegisterLayout>
    </div>
  );
}
