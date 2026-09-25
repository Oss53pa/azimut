import { type JSX, useMemo, useState } from 'react';
import type { Support } from '@azimut/core-model';
import { renderOrientedPlan, orientationDegForAzimuth } from '@azimut/engine-layout';
import { useSiteData } from '../context/useSiteData.js';
import { useI18n } from '../i18n/useI18n.js';
import {
  DataTable, RegisterLayout, Inspector, InspectorEmpty, Tag, SPACE, TEXT,
  type Column, type RegisterFilter,
} from '../components/ui/index.js';
import { FindingList } from './message-schedule/FindingList.js';
import { siteLabels } from './register/labels.js';
import { formatNumber } from './register/format.js';
import { ORIENTED_PLAN_PREVIEW_THEME, PLAN_PREVIEW_FONT_FAMILY } from './plans/plan-preview.js';

const ALL = 'all';
const PREVIEW_WIDTH = 288;
const PREVIEW_HEIGHT = 216;

type WallPlanRow = {
  readonly support: Support;
  readonly levelId: string | null;
  /** Rotation du plan, telle que le moteur la tire de l'azimut (D6.2). */
  readonly rotationDeg: number;
};

/**
 * Module 04 — les plans muraux orientés (D6), au gabarit « registre ».
 *
 * Un plan mural se tourne comme le regard du lecteur : ce qui est devant lui
 * est en haut. Chaque support implanté est un emplacement possible ; la
 * rotation vient de son azimut par `orientationDegForAzimuth`, et l'aperçu est
 * le rendu du moteur, jamais un dessin.
 */
export function WallPlansView(): JSX.Element {
  const site = useSiteData();
  const { t, lang } = useI18n();
  const [filter, setFilter] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const labels = useMemo(() => siteLabels(site, lang), [site, lang]);

  const rows = useMemo<readonly WallPlanRow[]>(() => [...site.supports]
    .sort((a, b) => (a.code ?? a.id).localeCompare(b.code ?? b.id))
    .map(support => ({
      support,
      levelId: labels.nodeLevel(support.node_id),
      rotationDeg: orientationDegForAzimuth(support.azimuth_deg),
    })), [site, labels]);

  const levels = site.levels.filter(l => rows.some(r => r.levelId === l.id));
  const visible = filter === ALL ? rows : rows.filter(r => r.levelId === filter);
  const selected = rows.find(r => r.support.id === selectedId) ?? visible[0] ?? null;

  const preview = useMemo(() => {
    if (selected === null || selected.levelId === null) return null;
    const node = site.graph.nodes.find(n => n.id === selected.support.node_id);
    if (node === undefined) return null;
    return renderOrientedPlan(site, selected.levelId, {
      width_px: PREVIEW_WIDTH,
      height_px: PREVIEW_HEIGHT,
      theme: ORIENTED_PLAN_PREVIEW_THEME,
      font_family: PLAN_PREVIEW_FONT_FAMILY,
      show_destinations: true,
      show_edges: true,
      padding_px: 12,
      orientation_deg: selected.rotationDeg,
      viewer_position: node.position,
      show_north_arrow: true,
    });
  }, [site, selected]);

  const filters: readonly RegisterFilter[] = [
    { id: ALL, label: t('placement.filter.all') },
    ...levels.map(l => ({ id: l.id, label: l.name })),
  ];

  const columns: readonly Column<WallPlanRow>[] = [
    { id: 'support', header: t('placement.col.code'), cell: r => r.support.code ?? r.support.id },
    { id: 'level', header: t('placement.col.level'), cell: r => (r.levelId === null ? '—' : labels.level(r.levelId)) },
    { id: 'node', header: t('placement.col.node'), cell: r => labels.node(r.support.node_id) },
    { id: 'azimuth', header: t('placement.col.azimuth'), numeric: true, cell: r => formatNumber(r.support.azimuth_deg, lang, 0) },
    { id: 'rotation', header: t('wallplans.col.rotation'), numeric: true, cell: r => formatNumber(r.rotationDeg, lang, 2) },
    {
      id: 'state',
      header: t('sitesheet.col.state'),
      cell: r => (r.levelId === null
        ? <Tag label={t('wallplans.state.orphan')} severity="blocking" />
        : <Tag label={t('wallplans.state.oriented')} severity="valid" />),
    },
  ];

  const inspector = selected === null
    ? <InspectorEmpty text={t('wallplans.inspector.empty')} />
    : (
      <Inspector
        title={selected.support.code ?? selected.support.id}
        subtitle={t('wallplans.inspector.subtitle', { node: labels.node(selected.support.node_id) })}
        sections={[
          {
            id: 'plan',
            title: t('wallplans.section.plan'),
            rows: [
              { id: 'azimuth', label: t('wallplans.field.azimuth'), value: formatNumber(selected.support.azimuth_deg, lang, 0), unit: '°' },
              { id: 'rotation', label: t('wallplans.col.rotation'), value: formatNumber(selected.rotationDeg, lang, 2), unit: '°', computed: true },
            ],
          },
        ]}
      >
        <section style={{ padding: '12px 16px' }}>
          {preview?.ok === true
            ? (
              <div
                className="az-svg-fit"
                role="img"
                aria-label={t('wallplans.preview.aria', { support: selected.support.code ?? selected.support.id })}
                style={{ border: '1px solid var(--border-hairline)', borderRadius: 4, overflow: 'hidden' }}
                dangerouslySetInnerHTML={{ __html: preview.value }}
              />
            )
            : <FindingList findings={preview?.ok === false ? preview.findings : []} empty={t('wallplans.preview.none')} />}
          <p style={{ margin: `${String(SPACE.sm)}px 0 0`, fontSize: TEXT.micro, color: 'var(--text-muted)' }}>
            {t('wallplans.preview.note')}
          </p>
        </section>
      </Inspector>
    );

  return (
    <RegisterLayout
      title={t('wallplans.title')}
      summary={t('wallplans.summary', { count: rows.length })}
      filtersLabel={t('register.filters')}
      filters={filters}
      filter={filter}
      onFilter={id => { setFilter(id); setSelectedId(null); }}
      shown={t('placement.shown', { count: visible.length })}
      inspector={inspector}
      note={t('wallplans.note')}
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
