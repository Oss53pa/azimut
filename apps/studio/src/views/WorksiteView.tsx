import { type JSX, useMemo } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import { auditInstallReserves } from '../domain/install-reserves.js';
import {
  DEMO_LOTS, DEMO_RESERVES, DEMO_INSTALL_SLOTS,
  type ProductionLot, type ReserveRecord, type InstallSlot,
} from '../domain/demo/production.js';
import {
  ScreenHeader, MetricRow, Panel, PanelGrid, DataTable, Tag, Note, StateBanner,
  SPACE, type Metric, type Column,
} from '../components/ui/index.js';
import { FindingList } from './message-schedule/FindingList.js';

const LOT_STATE_KEYS = {
  ordered: 'worksite.lot.ordered',
  in_production: 'worksite.lot.inproduction',
  delivered: 'worksite.lot.delivered',
  installed: 'worksite.lot.installed',
} as const;

const OBSERVATION_KEYS = {
  'worksite.observation.fixing': 'worksite.observation.fixing',
  'worksite.observation.scratch': 'worksite.observation.scratch',
  'worksite.observation.plumb': 'worksite.observation.plumb',
  'worksite.observation.lamp': 'worksite.observation.lamp',
} as const;

type ObservationKey = keyof typeof OBSERVATION_KEYS;

function observationKey(key: string): ObservationKey {
  return key in OBSERVATION_KEYS ? (key as ObservationKey) : 'worksite.observation.fixing';
}

/**
 * Module 07 — chantier et pose. Un support ne bascule en « posé » qu'une fois
 * ses réserves levées : c'est ce qui donne à la couche de divergence du module
 * 08 une origine connue.
 */
export function WorksiteView(): JSX.Element {
  const { t } = useI18n();

  const openReserves = useMemo(() => {
    const result = auditInstallReserves(DEMO_RESERVES.map(r => r.reserve));
    return result.ok ? result.warnings : result.findings;
  }, []);

  const totalSupports = DEMO_LOTS.reduce((n, lot) => n + lot.support_count, 0);
  const delivered = DEMO_LOTS
    .filter(lot => lot.state === 'delivered' || lot.state === 'installed')
    .reduce((n, lot) => n + lot.support_count, 0);
  const planned = DEMO_INSTALL_SLOTS
    .filter(slot => slot.date !== null)
    .reduce((n, slot) => n + slot.support_count, 0);
  const unplanned = DEMO_INSTALL_SLOTS
    .filter(slot => slot.date === null)
    .reduce((n, slot) => n + slot.support_count, 0);

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

  const lotColumns: readonly Column<ProductionLot>[] = [
    { id: 'id', header: t('worksite.col.lot'), cell: l => l.id },
    { id: 'manufacturer', header: t('worksite.col.manufacturer'), cell: l => l.manufacturer },
    { id: 'count', header: t('worksite.col.supports'), numeric: true, cell: l => String(l.support_count) },
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

  const reserveColumns: readonly Column<ReserveRecord>[] = [
    { id: 'id', header: t('worksite.col.reserve'), cell: r => r.reserve.id },
    { id: 'support', header: t('worksite.col.support'), cell: r => r.reserve.support_id },
    { id: 'lot', header: t('worksite.col.lot'), cell: r => r.lot_id },
    { id: 'observation', header: t('worksite.col.observation'), cell: r => t(observationKey(r.observation_key)) },
    { id: 'by', header: t('worksite.col.observedby'), cell: r => r.observed_by },
    {
      id: 'lifted',
      header: t('worksite.col.lifted'),
      cell: r => (
        <Tag
          label={r.reserve.lifted ? (r.lifted_on ?? t('worksite.reserve.lifted')) : t('worksite.reserve.open')}
          severity={r.reserve.lifted ? 'valid' : 'warning'}
        />
      ),
    },
  ];

  const slotColumns: readonly Column<InstallSlot>[] = [
    { id: 'date', header: t('worksite.col.date'), cell: s => s.date ?? t('worksite.slot.unplanned') },
    { id: 'zone', header: t('worksite.col.zone'), cell: s => s.zone },
    { id: 'count', header: t('worksite.col.supports'), numeric: true, cell: s => String(s.support_count) },
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
      <ScreenHeader
        eyebrow={t('worksite.eyebrow')}
        title={t('worksite.title')}
        subtitle={t('worksite.subtitle')}
      />

      <div style={{ marginBottom: SPACE.md }}>
        <StateBanner severity="info" message={t('demo.dataset.message')} hint={t('demo.dataset.hint')} />
      </div>

      <MetricRow metrics={metrics} />

      <div style={{ marginTop: SPACE.lg }}>
        <PanelGrid min={320}>
          <Panel title={t('worksite.panel.lots')} padded={false}>
            <DataTable columns={lotColumns} rows={DEMO_LOTS} rowKey={l => l.id} empty={t('worksite.lots.empty')} />
          </Panel>
          <Panel title={t('worksite.panel.slots')} note={t('worksite.panel.slots.note')} padded={false}>
            <DataTable columns={slotColumns} rows={DEMO_INSTALL_SLOTS} rowKey={s => s.id} empty={t('worksite.slots.empty')} />
          </Panel>
        </PanelGrid>
      </div>

      <div style={{ marginTop: SPACE.lg }}>
        <Panel title={t('worksite.panel.reserves')} note={t('worksite.panel.reserves.note')} padded={false}>
          <DataTable
            columns={reserveColumns}
            rows={DEMO_RESERVES}
            rowKey={r => r.reserve.id}
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
