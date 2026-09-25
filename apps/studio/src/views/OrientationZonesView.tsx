import { type JSX, useMemo, useState } from 'react';
import type { NamingRule } from '@azimut/core-model';
import { useSiteData } from '../context/useSiteData.js';
import { useSiteWayfinding } from '../context/useSiteWayfinding.js';
import { useI18n } from '../i18n/useI18n.js';
import {
  DataTable, RegisterLayout, Inspector, InspectorEmpty, Panel, Tag, Note, SPACE,
  type Column, type RegisterFilter,
} from '../components/ui/index.js';
import { zoneRows, type ZoneRow } from './wayfinding/zone-rows.js';
import { RegistryBanner } from './wayfinding/RegistryBanner.js';
import { siteLabels } from './register/labels.js';
import { formatNumber } from './register/format.js';

const ALL = 'all';
const ANOMALIES = 'anomalies';

const hasAnomaly = (r: ZoneRow): boolean => r.missingFootprints.length > 0 || r.sharedFootprints.length > 0;

/**
 * Module 02 — le zonage d'orientation (N2.2), au gabarit « registre ». Les
 * zones et les règles de nommage sont lues du registre du wayfinding ; la
 * surface et les destinations d'une zone se calculent depuis ses empreintes.
 * L'écran lit, il n'écrit pas.
 */
export function OrientationZonesView(): JSX.Element {
  const site = useSiteData();
  const wayfinding = useSiteWayfinding();
  const { t, lang } = useI18n();
  const [filter, setFilter] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const labels = useMemo(() => siteLabels(site, lang), [site, lang]);

  const { zones, naming_rules: rules } = wayfinding.registry;
  const rows = useMemo(() => zoneRows(site, zones), [site, zones]);
  const footprints = useMemo(() => new Map(site.footprints.map(f => [f.id, f])), [site]);

  const visible = rows.filter(r => {
    if (filter === ALL) return true;
    if (filter === ANOMALIES) return hasAnomaly(r);
    return r.zone.kind === filter;
  });
  const selected = rows.find(r => r.zone.id === selectedId) ?? visible[0] ?? null;

  const zoneName = (r: ZoneRow): string => (lang === 'en' ? r.zone.name_en : r.zone.name_fr);
  const kindLabel = (r: ZoneRow): string => t(`zones.kind.${r.zone.kind}`);
  const footprintLabel = (id: string): string => {
    const fp = footprints.get(id);
    if (fp === undefined) return id;
    return `${fp.unit_code ?? id} · ${labels.level(fp.level_id)}`;
  };

  const filters: readonly RegisterFilter[] = [
    { id: ALL, label: t('zones.filter.all') },
    ...[...new Set(rows.map(r => r.zone.kind))].map(kind => ({ id: kind, label: t(`zones.kind.${kind}`) })),
    { id: ANOMALIES, label: t('zones.filter.anomalies') },
  ];

  const columns: readonly Column<ZoneRow>[] = [
    { id: 'code', header: t('zones.col.code'), cell: r => r.zone.code },
    { id: 'name', header: t('zones.col.name'), cell: zoneName },
    { id: 'kind', header: t('zones.col.kind'), cell: kindLabel },
    { id: 'footprints', header: t('zones.col.footprints'), numeric: true, cell: r => String(new Set(r.zone.footprint_ids).size) },
    { id: 'area', header: t('zones.col.area'), numeric: true, cell: r => formatNumber(r.areaM2, lang, 2) },
    { id: 'destinations', header: t('zones.col.destinations'), numeric: true, cell: r => String(r.destinations) },
    {
      id: 'state',
      header: t('zones.col.state'),
      cell: r => {
        if (r.missingFootprints.length > 0) return <Tag label={t('zones.state.missing')} severity="blocking" />;
        if (r.sharedFootprints.length > 0) return <Tag label={t('zones.state.shared')} severity="warning" />;
        return <Tag label={t('zones.state.ok')} severity="valid" />;
      },
    },
  ];

  const ruleColumns: readonly Column<NamingRule>[] = [
    { id: 'target', header: t('naming.col.target'), cell: r => t(`naming.target.${r.target}`) },
    { id: 'pattern', header: t('naming.col.pattern'), cell: r => r.pattern },
    { id: 'max', header: t('naming.col.max'), numeric: true, cell: r => String(r.max_length) },
    { id: 'scope', header: t('naming.col.scope'), cell: r => t(`naming.scope.${r.uniqueness_scope}`) },
  ];

  const footprintState = (r: ZoneRow, id: string): string => {
    if (r.missingFootprints.includes(id)) return t('zones.footprint.missing');
    if (r.sharedFootprints.includes(id)) return t('zones.footprint.shared');
    return t('zones.footprint.present');
  };

  const inspector = selected === null
    ? <InspectorEmpty text={t('zones.inspector.empty')} />
    : (
      <Inspector
        title={zoneName(selected)}
        subtitle={t('zones.inspector.subtitle', { kind: kindLabel(selected), code: selected.zone.code })}
        sections={[
          {
            id: 'zone',
            title: t('zones.section.zone'),
            rows: [
              { id: 'code', label: t('zones.col.code'), value: selected.zone.code },
              { id: 'fr', label: t('zones.field.namefr'), value: selected.zone.name_fr },
              { id: 'en', label: t('zones.field.nameen'), value: selected.zone.name_en },
              { id: 'kind', label: t('zones.col.kind'), value: kindLabel(selected) },
            ],
          },
          {
            id: 'footprints',
            title: t('zones.section.footprints'),
            note: t('zones.section.footprints.note'),
            rows: [...new Set(selected.zone.footprint_ids)].sort().map(id => ({
              id, label: footprintLabel(id), value: footprintState(selected, id),
            })),
          },
          {
            id: 'computed',
            title: t('sitesheet.section.computed'),
            rows: [
              { id: 'area', label: t('zones.col.area'), value: formatNumber(selected.areaM2, lang, 2), unit: 'm²', computed: true },
              { id: 'destinations', label: t('zones.col.destinations'), value: String(selected.destinations), computed: true },
              { id: 'missing', label: t('zones.field.missing'), value: String(selected.missingFootprints.length), computed: true },
              { id: 'shared', label: t('zones.field.shared'), value: String(selected.sharedFootprints.length), computed: true },
            ],
          },
        ]}
      />
    );

  const banner = <RegistryBanner state={wayfinding} empty={zones.length === 0} emptyMessage={t('wfregistry.empty.zones')} />;
  if (wayfinding.status !== 'ready') return <div>{banner}</div>;

  return (
    <div>
      {banner}
      <RegisterLayout
        title={t('zones.title')}
        summary={t('zones.summary', { count: rows.length, rules: rules.length })}
        filtersLabel={t('register.filters')}
        filters={filters}
        filter={filter}
        onFilter={id => { setFilter(id); setSelectedId(null); }}
        shown={t('zones.shown', { count: visible.length })}
        inspector={inspector}
        note={t('zones.note')}
      >
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={r => r.zone.id}
          empty={t('zones.empty')}
          onSelect={r => { setSelectedId(r.zone.id); }}
          selectedKey={selected?.zone.id}
        />
      </RegisterLayout>
      <div style={{ marginTop: SPACE.lg }}>
        <Panel title={t('naming.panel')} note={String(rules.length)} padded={false}>
          <DataTable columns={ruleColumns} rows={rules} rowKey={r => r.id} empty={t('naming.empty')} />
        </Panel>
      </div>
      <Note>{t('naming.note')}</Note>
    </div>
  );
}
