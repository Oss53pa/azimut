import { type JSX, useMemo } from 'react';
import {
  EMPTY_WORKSITE_REGISTRY, type FabricationLot, type InstallSlot, type RecordedReserve,
} from '@azimut/core-model';
import { useI18n } from '../i18n/useI18n.js';
import { loadWorksite, useRegistry } from '../data/index.js';
import {
  ScreenHeader, MetricRow, Panel, PanelGrid, DataTable, Tag, Note,
  SPACE, type Metric, type Column,
} from '../components/ui/index.js';
import { FindingList } from './message-schedule/FindingList.js';
import { RegistryStatus } from './register/RegistryStatus.js';
import { openReserveFindings } from './worksite/rows.js';
import { LOT_STATE_KEYS, observationKey } from './worksite/labels.js';

type WorksiteViewProps = {
  /** Clé du site dans le dépôt, celle dont la coquille l'a chargé. */
  readonly siteKey: string;
};

/**
 * Module 07 — chantier et pose. Un support ne bascule en « posé » qu'une fois
 * ses réserves levées : c'est ce qui donne à la couche de divergence du module
 * 08 une origine connue. Lu en base (0042), ou dans le jeu de démonstration du
 * dépôt de référence.
 */
export function WorksiteView({ siteKey }: WorksiteViewProps): JSX.Element {
  const { t } = useI18n();
  const state = useRegistry(loadWorksite, EMPTY_WORKSITE_REGISTRY, siteKey);
  const { lots, slots, reserves } = state.registry;
  const openReserves = useMemo(() => openReserveFindings(reserves), [reserves]);
  const lotCodes = useMemo(() => new Map(lots.map(l => [l.id, l.code])), [lots]);

  const header = (
    <ScreenHeader eyebrow={t('worksite.eyebrow')} title={t('worksite.title')} subtitle={t('worksite.subtitle')} />
  );
  if (state.status !== 'ready') return <div>{header}<RegistryStatus state={state} /></div>;

  const count = (list: readonly { readonly support_ids: readonly string[] }[]): number =>
    list.reduce((n, item) => n + item.support_ids.length, 0);
  const totalSupports = count(lots);
  const delivered = count(lots.filter(lot => lot.state === 'delivered' || lot.state === 'installed'));
  const planned = count(slots.filter(slot => slot.planned_on !== null));
  const unplanned = count(slots.filter(slot => slot.planned_on === null));

  const metrics: readonly Metric[] = [
    { id: 'ordered', label: t('worksite.metric.ordered'), value: String(totalSupports) },
    { id: 'delivered', label: t('worksite.metric.delivered'), value: String(delivered) },
    { id: 'planned', label: t('worksite.metric.planned'), value: String(planned) },
    {
      id: 'unplanned',
      label: t('worksite.metric.unplanned'),
      value: String(unplanned),
      severity: unplanned > 0 ? 'warning' : 'valid',
    },
    {
      id: 'reserves',
      label: t('worksite.metric.reserves'),
      value: String(openReserves.length),
      severity: openReserves.length > 0 ? 'warning' : 'valid',
    },
  ];

  const lotColumns: readonly Column<FabricationLot>[] = [
    { id: 'id', header: t('worksite.col.lot'), cell: l => l.code },
    { id: 'manufacturer', header: t('worksite.col.manufacturer'), cell: l => l.manufacturer_name },
    { id: 'count', header: t('worksite.col.supports'), numeric: true, cell: l => String(l.support_ids.length) },
    {
      id: 'state',
      header: t('worksite.col.state'),
      cell: l => (
        <Tag
          label={t(LOT_STATE_KEYS[l.state])}
          severity={l.state === 'installed' ? 'valid' : l.state === 'ordered' ? undefined : 'info'}
          muted={l.state === 'ordered'}
        />
      ),
    },
  ];

  const reserveColumns: readonly Column<RecordedReserve>[] = [
    { id: 'id', header: t('worksite.col.reserve'), cell: r => r.id },
    { id: 'support', header: t('worksite.col.support'), cell: r => r.support_id },
    { id: 'lot', header: t('worksite.col.lot'), cell: r => lotCodes.get(r.lot_id) ?? r.lot_id },
    {
      id: 'observation',
      header: t('worksite.col.observation'),
      cell: r => { const key = observationKey(r.observation_key); return key === null ? r.observation_key : t(key); },
    },
    { id: 'by', header: t('worksite.col.observedby'), cell: r => r.observed_by },
    {
      id: 'lifted',
      header: t('worksite.col.lifted'),
      cell: r => (
        <Tag
          label={r.lifted_at !== null ? r.lifted_at.slice(0, 10) : t('worksite.reserve.open')}
          severity={r.lifted_at !== null ? 'valid' : 'warning'}
        />
      ),
    },
  ];

  const slotColumns: readonly Column<InstallSlot>[] = [
    { id: 'date', header: t('worksite.col.date'), cell: s => s.planned_on ?? t('worksite.slot.unplanned') },
    { id: 'zone', header: t('worksite.col.zone'), cell: s => s.zone_label },
    { id: 'count', header: t('worksite.col.supports'), numeric: true, cell: s => String(s.support_ids.length) },
    {
      id: 'shift',
      header: t('worksite.col.shift'),
      cell: s => (
        <Tag
          label={s.night_work ? t('worksite.shift.night') : t('worksite.shift.day')}
          muted={!s.night_work}
        />
      ),
    },
  ];

  return (
    <div>
      {header}
      <RegistryStatus state={state} />

      <MetricRow metrics={metrics} />

      <div style={{ marginTop: SPACE.lg }}>
        <PanelGrid min={320}>
          <Panel title={t('worksite.panel.lots')} padded={false}>
            <DataTable columns={lotColumns} rows={lots} rowKey={l => l.id} empty={t('worksite.lots.empty')} />
          </Panel>
          <Panel title={t('worksite.panel.slots')} note={t('worksite.panel.slots.note')} padded={false}>
            <DataTable columns={slotColumns} rows={slots} rowKey={s => s.id} empty={t('worksite.slots.empty')} />
          </Panel>
        </PanelGrid>
      </div>

      <div style={{ marginTop: SPACE.lg }}>
        <Panel title={t('worksite.panel.reserves')} note={t('worksite.panel.reserves.note')} padded={false}>
          <DataTable
            columns={reserveColumns}
            rows={reserves}
            rowKey={r => r.id}
            empty={t('worksite.reserves.empty')}
          />
        </Panel>
      </div>

      <div style={{ marginTop: SPACE.lg }}>
        <Panel title={t('worksite.panel.findings')} note={String(openReserves.length)}>
          <FindingList findings={openReserves} empty={t('worksite.findings.empty')} />
          <Note>{t('worksite.findings.note')}</Note>
        </Panel>
      </div>

      <Note>{t('worksite.note')}</Note>
    </div>
  );
}
