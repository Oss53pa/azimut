import { type JSX, useMemo, useState } from 'react';
import { supportTypologyOf, type Support } from '@azimut/core-model';
import { deriveDecisionPoints } from '@azimut/engine-graph';
import { useSiteData } from '../context/useSiteData.js';
import { useI18n } from '../i18n/useI18n.js';
import {
  DataTable, RegisterLayout, Inspector, InspectorEmpty, Tag,
  type Column, type RegisterFilter,
} from '../components/ui/index.js';
import { siteLabels } from './register/labels.js';
import { formatNumber } from './register/format.js';

const ALL = 'all';
const EMPTY = '—';

type PlacementRow = {
  readonly support: Support;
  readonly levelId: string | null;
  readonly faces: number;
  /** Nombre de branches du point de décision où il est posé, ou `null`. */
  readonly branches: number | null;
};

/**
 * Module 02 — l'implantation des supports, au gabarit « registre » : un
 * support par ligne, son nœud, son orientation, sa distance de lecture, et
 * s'il est posé sur un point de décision du premier profil.
 */
export function PlacementView(): JSX.Element {
  const site = useSiteData();
  const { t, lang } = useI18n();
  const [filter, setFilter] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const labels = useMemo(() => siteLabels(site, lang), [site, lang]);
  const profile = site.travel_profiles[0];

  const rows = useMemo<readonly PlacementRow[]>(() => {
    const points = profile === undefined ? null : deriveDecisionPoints(site, profile, site.destinations);
    const branches = new Map(points?.ok === true ? points.value.map(p => [p.node_id, p.branch_count]) : []);
    const faces = new Map<string, number>();
    for (const f of site.support_faces) faces.set(f.support_id, (faces.get(f.support_id) ?? 0) + 1);
    return [...site.supports]
      .sort((a, b) => (a.code ?? a.id).localeCompare(b.code ?? b.id))
      .map(support => ({
        support,
        levelId: labels.nodeLevel(support.node_id),
        faces: faces.get(support.id) ?? 0,
        branches: branches.get(support.node_id) ?? null,
      }));
  }, [site, profile, labels]);

  const levels = site.levels.filter(l => rows.some(r => r.levelId === l.id));
  const visible = filter === ALL ? rows : rows.filter(r => r.levelId === filter);
  const selected = rows.find(r => r.support.id === selectedId) ?? visible[0] ?? null;
  const atPoints = rows.filter(r => r.branches !== null).length;

  const filters: readonly RegisterFilter[] = [
    { id: ALL, label: t('placement.filter.all') },
    ...levels.map(l => ({ id: l.id, label: l.name })),
  ];

  const typology = (s: Support): JSX.Element | string => {
    const type = supportTypologyOf(site.support_types, s);
    return type === null ? <Tag label={t('placement.typology.none')} severity="warning" /> : type.name;
  };
  const typologyName = (s: Support): string =>
    supportTypologyOf(site.support_types, s)?.name ?? t('placement.typology.none');

  const dims = (s: Support): string => (s.width_mm !== undefined && s.height_mm !== undefined
    ? `${formatNumber(s.width_mm, lang, 0)} × ${formatNumber(s.height_mm, lang, 0)}`
    : EMPTY);

  const columns: readonly Column<PlacementRow>[] = [
    { id: 'code', header: t('placement.col.code'), cell: r => r.support.code ?? r.support.id },
    { id: 'level', header: t('placement.col.level'), cell: r => (r.levelId === null ? EMPTY : labels.level(r.levelId)) },
    { id: 'node', header: t('placement.col.node'), cell: r => labels.node(r.support.node_id) },
    { id: 'typology', header: t('placement.col.typology'), cell: r => typology(r.support) },
    { id: 'registry', header: t('placement.col.registry'), cell: r => t(`placement.registry.${r.support.registry}`) },
    { id: 'azimuth', header: t('placement.col.azimuth'), numeric: true, cell: r => formatNumber(r.support.azimuth_deg, lang, 0) },
    { id: 'distance', header: t('placement.col.distance'), numeric: true, cell: r => formatNumber(r.support.reading_distance_m, lang, 2) },
    { id: 'faces', header: t('placement.col.faces'), numeric: true, cell: r => String(r.faces) },
    {
      id: 'point',
      header: t('placement.col.point'),
      cell: r => (r.branches === null
        ? <Tag label={t('placement.point.no')} severity="warning" />
        : <Tag label={t('placement.point.yes')} severity="valid" />),
    },
  ];

  const inspector = selected === null
    ? <InspectorEmpty text={t('placement.inspector.empty')} />
    : (
      <Inspector
        title={selected.support.code ?? selected.support.id}
        subtitle={t('placement.inspector.subtitle', {
          registry: t(`placement.registry.${selected.support.registry}`),
          context: t(`placement.context.${selected.support.context}`),
        })}
        sections={[
          {
            id: 'placement',
            title: t('placement.section.placement'),
            rows: [
              { id: 'level', label: t('placement.col.level'), value: selected.levelId === null ? EMPTY : labels.level(selected.levelId) },
              { id: 'node', label: t('placement.col.node'), value: labels.node(selected.support.node_id) },
              { id: 'typology', label: t('placement.col.typology'), value: typologyName(selected.support) },
              { id: 'azimuth', label: t('placement.field.azimuth'), value: formatNumber(selected.support.azimuth_deg, lang, 0), unit: '°' },
              { id: 'distance', label: t('placement.field.distance'), value: formatNumber(selected.support.reading_distance_m, lang, 2), unit: 'm' },
              { id: 'dims', label: t('placement.field.dims'), value: dims(selected.support), unit: 'mm' },
            ],
          },
          {
            id: 'computed',
            title: t('sitesheet.section.computed'),
            rows: [
              { id: 'faces', label: t('placement.col.faces'), value: String(selected.faces), computed: true },
              {
                id: 'branches',
                label: t('placement.field.branches'),
                value: selected.branches === null ? t('placement.point.no') : String(selected.branches),
                computed: true,
              },
            ],
          },
        ]}
      />
    );

  return (
    <RegisterLayout
      title={t('placement.title')}
      summary={t('placement.summary', { supports: rows.length, points: atPoints })}
      filtersLabel={t('register.filters')}
      filters={filters}
      filter={filter}
      onFilter={id => { setFilter(id); setSelectedId(null); }}
      shown={t('placement.shown', { count: visible.length })}
      inspector={inspector}
      note={t('placement.note')}
    >
      <DataTable
        columns={columns}
        rows={visible}
        rowKey={r => r.support.id}
        empty={t('placement.empty')}
        onSelect={r => { setSelectedId(r.support.id); }}
        selectedKey={selected?.support.id}
      />
    </RegisterLayout>
  );
}
