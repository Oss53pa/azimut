import { type JSX, useMemo, useState } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import { useI18n } from '../i18n/useI18n.js';
import { appRepository, useMaintenanceRegistryLoad } from '../data/index.js';
import {
  DataTable, RegisterLayout, Inspector, InspectorEmpty, Tag, StateBanner, SPACE,
  type Column, type RegisterFilter,
} from '../components/ui/index.js';
import { fleetRows, isOpen, lastPose, type FleetRow } from './operations/fleet-rows.js';
import { MaintenanceBanner } from './operations/MaintenanceBanner.js';
import { siteLabels } from './register/labels.js';
import { formatDay } from './register/format.js';

const ALL = 'all';
const INSTALLED = 'installed';
const NOT_INSTALLED = 'notinstalled';
const OPEN = 'open';
const EMPTY = '—';

type OpsFleetViewProps = {
  /** Clé du site dans le dépôt, celle dont la coquille l'a chargé. */
  readonly siteKey: string;
};

/**
 * Module 08 — l'état du parc (A5.7), au gabarit « registre » : un support du
 * site par ligne, ses poses et les divergences relevées sur elles, lues en
 * base. L'écran ne pose rien et ne résout rien.
 */
export function OpsFleetView({ siteKey }: OpsFleetViewProps): JSX.Element {
  const site = useSiteData();
  const { t, lang } = useI18n();
  const repository = useMemo(() => appRepository(), []);
  const state = useMaintenanceRegistryLoad(repository, siteKey);
  const labels = useMemo(() => siteLabels(site, lang), [site, lang]);
  const [filter, setFilter] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo(() => fleetRows(site, state.registry), [site, state.registry]);
  const day = (iso: string): string => formatDay(iso.slice(0, 10), lang) ?? iso;

  const banner = (
    <MaintenanceBanner
      state={state}
      empty={state.registry.installed.length === 0}
      emptyMessage={t('fleet.empty.registry')}
    />
  );
  if (state.status !== 'ready') return <div>{banner}</div>;

  const siteSupports = new Set(site.supports.map(s => s.id));
  const orphans = state.registry.installed.filter(p => !siteSupports.has(p.support_id)).length;

  const visible = rows.filter(r => {
    if (filter === INSTALLED) return r.poses.length > 0;
    if (filter === NOT_INSTALLED) return r.poses.length === 0;
    if (filter === OPEN) return r.openDivergences > 0;
    return true;
  });
  const selected = rows.find(r => r.support.id === selectedId) ?? visible[0] ?? null;

  const filters: readonly RegisterFilter[] = [
    { id: ALL, label: t('fleet.filter.all') },
    { id: INSTALLED, label: t('fleet.filter.installed') },
    { id: NOT_INSTALLED, label: t('fleet.filter.notinstalled') },
    { id: OPEN, label: t('fleet.filter.open') },
  ];

  const level = (r: FleetRow): string => {
    const id = labels.nodeLevel(r.support.node_id);
    return id === null ? EMPTY : labels.level(id);
  };
  const stateTag = (r: FleetRow): JSX.Element => {
    if (r.openDivergences > 0) return <Tag label={t('fleet.state.open')} severity="blocking" />;
    if (r.poses.length === 0) return <Tag label={t('fleet.state.notinstalled')} severity="warning" />;
    return <Tag label={t('fleet.state.installed')} severity="valid" />;
  };

  const columns: readonly Column<FleetRow>[] = [
    { id: 'support', header: t('fleet.col.support'), cell: r => r.support.code ?? r.support.id },
    { id: 'level', header: t('fleet.col.level'), cell: level },
    { id: 'installed', header: t('fleet.col.installed'), cell: r => { const p = lastPose(r); return p === null ? EMPTY : day(p.installed_at); } },
    { id: 'poses', header: t('fleet.col.poses'), numeric: true, cell: r => String(r.poses.length) },
    { id: 'open', header: t('fleet.col.open'), numeric: true, cell: r => String(r.openDivergences) },
    { id: 'state', header: t('fleet.col.state'), cell: stateTag },
  ];

  const inspector = selected === null
    ? <InspectorEmpty text={t('fleet.inspector.empty')} />
    : (
      <Inspector
        title={selected.support.code ?? selected.support.id}
        subtitle={t('fleet.inspector.subtitle', { level: level(selected), node: labels.node(selected.support.node_id) })}
        sections={[
          {
            id: 'poses',
            title: t('fleet.section.poses'),
            rows: selected.poses.length === 0
              ? [{ id: 'none', label: t('fleet.none'), value: '' }]
              : selected.poses.map(p => ({
                id: p.id,
                label: t('fleet.pose.label', { date: day(p.installed_at) }),
                value: [p.photo_path === null ? t('fleet.pose.nophoto') : t('fleet.pose.photo'), p.installer_notes ?? '']
                  .filter(v => v !== '').join(' · '),
              })),
          },
          {
            id: 'divergences',
            title: t('fleet.section.divergences'),
            rows: selected.divergences.length === 0
              ? [{ id: 'none', label: t('fleet.none'), value: '' }]
              : selected.divergences.map(d => ({
                id: d.id,
                label: t('fleet.divergence.label', { kind: t(`maint.kind.${d.kind}`), date: day(d.detected_at) }),
                value: isOpen(d) ? t('maint.divergence.open') : t('maint.divergence.resolved'),
              })),
          },
        ]}
      />
    );

  return (
    <div>
      {banner}
      {orphans > 0 && (
        <div style={{ marginBottom: SPACE.lg }}>
          <StateBanner severity="warning" message={t('fleet.orphans', { count: orphans })} />
        </div>
      )}
      <RegisterLayout
        title={t('fleet.title')}
        summary={t('fleet.summary', {
          supports: rows.length,
          installed: rows.filter(r => r.poses.length > 0).length,
          open: rows.reduce((n, r) => n + r.openDivergences, 0),
        })}
        filtersLabel={t('register.filters')}
        filters={filters}
        filter={filter}
        onFilter={id => { setFilter(id); setSelectedId(null); }}
        shown={t('fleet.shown', { count: visible.length })}
        inspector={inspector}
        note={t('fleet.note')}
      >
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={r => r.support.id}
          empty={t('fleet.empty')}
          onSelect={r => { setSelectedId(r.support.id); }}
          selectedKey={selected?.support.id}
        />
      </RegisterLayout>
    </div>
  );
}
