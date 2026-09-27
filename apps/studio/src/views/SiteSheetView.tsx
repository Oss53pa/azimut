import { type JSX, useMemo, useState } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import { useI18n } from '../i18n/useI18n.js';
import type { UiMessageKey } from '../i18n/messages.js';
import {
  DataTable, RegisterLayout, Inspector, InspectorEmpty, Tag,
  type Column, type RegisterFilter, type Severity,
} from '../components/ui/index.js';
import { levelRows, type LevelRow, type PlanState } from './register/site-sheet-rows.js';
import { formatDay, formatNumber } from './register/format.js';

const ALL = 'all';
const EMPTY = '—';

const PLAN_STATE: Readonly<Record<PlanState, { readonly key: UiMessageKey; readonly severity: Severity }>> = {
  calibrated: { key: 'sitesheet.plan.calibrated', severity: 'valid' },
  uncalibrated: { key: 'sitesheet.plan.uncalibrated', severity: 'warning' },
  absent: { key: 'sitesheet.plan.absent', severity: 'blocking' },
};

/**
 * Module 01 — la fiche de site, au gabarit « registre » de la maquette : les
 * niveaux de chaque bâtiment, leur fond de plan et son calage, et ce que le
 * site porte sur chacun. Les surfaces et les comptes sont calculés.
 */
export function SiteSheetView(): JSX.Element {
  const site = useSiteData();
  const { t, lang } = useI18n();
  const rows = useMemo(() => levelRows(site), [site]);
  const [filter, setFilter] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visible = filter === ALL ? rows : rows.filter(r => r.buildingId === filter);
  const selected = rows.find(r => r.id === selectedId) ?? visible[0] ?? null;

  const filters: readonly RegisterFilter[] = [
    { id: ALL, label: t('sitesheet.filter.all') },
    ...site.buildings.map(b => ({ id: b.id, label: b.name })),
  ];

  const columns: readonly Column<LevelRow>[] = [
    { id: 'level', header: t('sitesheet.col.level'), cell: r => r.name },
    { id: 'building', header: t('sitesheet.col.building'), cell: r => r.buildingName },
    { id: 'elevation', header: t('sitesheet.col.elevation'), numeric: true, cell: r => formatNumber(r.elevationM, lang, 2) },
    { id: 'plan', header: t('sitesheet.col.plan'), cell: r => r.planFile ?? EMPTY },
    {
      id: 'state',
      header: t('sitesheet.col.state'),
      cell: r => <Tag label={t(PLAN_STATE[r.planState].key)} severity={PLAN_STATE[r.planState].severity} />,
    },
    {
      id: 'area',
      header: t('sitesheet.col.area'),
      numeric: true,
      cell: r => (r.footprints === 0 ? EMPTY : formatNumber(r.footprintAreaM2, lang, 2)),
    },
    { id: 'updated', header: t('sitesheet.col.updated'), cell: r => formatDay(r.updatedAt, lang) ?? EMPTY },
  ];

  const inspector = selected === null
    ? <InspectorEmpty text={t('sitesheet.inspector.empty')} />
    : (
      <Inspector
        title={selected.name}
        subtitle={t('sitesheet.inspector.subtitle', {
          building: selected.buildingName,
          state: t(PLAN_STATE[selected.planState].key),
        })}
        sections={[
          {
            id: 'site',
            title: t('sitesheet.section.site'),
            rows: [
              { id: 'name', label: t('sitesheet.field.name'), value: site.site.name },
              { id: 'country', label: t('sitesheet.field.country'), value: site.site.country_code },
              { id: 'timezone', label: t('sitesheet.field.timezone'), value: site.site.timezone },
              { id: 'langs', label: t('sitesheet.field.langs'), value: site.site.active_langs.join(' · ') },
              {
                id: 'rules',
                label: t('sitesheet.field.rules'),
                value: site.site.rules_pack_id ?? t('sitesheet.field.rules.none'),
              },
            ],
          },
          {
            id: 'level',
            title: t('sitesheet.section.level'),
            rows: [
              { id: 'elevation', label: t('sitesheet.field.elevation'), value: formatNumber(selected.elevationM, lang, 2), unit: 'm' },
              { id: 'ordinal', label: t('sitesheet.field.ordinal'), value: String(selected.ordinal) },
              { id: 'plan', label: t('sitesheet.field.plan'), value: selected.planFile ?? EMPTY },
            ],
          },
          {
            id: 'computed',
            title: t('sitesheet.section.computed'),
            note: t('sitesheet.section.computed.note'),
            rows: [
              { id: 'area', label: t('sitesheet.field.area'), value: formatNumber(selected.footprintAreaM2, lang, 2), unit: 'm²', computed: true },
              { id: 'footprints', label: t('sitesheet.field.footprints'), value: String(selected.footprints), computed: true },
              { id: 'nodes', label: t('sitesheet.field.nodes'), value: String(selected.nodes), computed: true },
              { id: 'supports', label: t('sitesheet.field.supports'), value: String(selected.supports), computed: true },
              { id: 'destinations', label: t('sitesheet.field.destinations'), value: String(selected.destinations), computed: true },
            ],
          },
        ]}
      />
    );

  return (
    <RegisterLayout
      title={t('sitesheet.title')}
      summary={t('sitesheet.summary', {
        site: site.site.name,
        buildings: site.buildings.length,
        levels: rows.length,
      })}
      filtersLabel={t('register.filters')}
      filters={filters}
      filter={filter}
      onFilter={id => { setFilter(id); setSelectedId(null); }}
      shown={t('sitesheet.shown', { count: visible.length })}
      inspector={inspector}
      note={t('sitesheet.note')}
    >
      <DataTable
        columns={columns}
        rows={visible}
        rowKey={r => r.id}
        empty={t('sitesheet.empty')}
        onSelect={r => { setSelectedId(r.id); }}
        selectedKey={selected?.id}
      />
    </RegisterLayout>
  );
}
