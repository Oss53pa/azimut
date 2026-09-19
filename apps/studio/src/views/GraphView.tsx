import { type JSX, useMemo, useState } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import { useI18n } from '../i18n/useI18n.js';
import { validateGraph, deriveDecisionPoints } from '@azimut/engine-graph';
import type { Finding, Edge } from '@azimut/core-model';
import type { ViewId } from '../views.js';
import {
  ScreenHeader, MetricRow, Panel, PanelGrid, DataTable, Tag, Note,
  SPACE, TEXT, type Metric, type Column,
} from '../components/ui/index.js';
import { FindingList } from './message-schedule/FindingList.js';

type GraphViewProps = {
  readonly onNavigate: (view: ViewId) => void;
};

type EdgeRow = {
  readonly edge: Edge;
  readonly from: string;
  readonly to: string;
  readonly crossLevel: boolean;
};

/**
 * Module 01 · écran M4 (partie M) — le graphe de circulation.
 *
 * Le tracé appartient à l'atelier : un second canevas de tracé ouvrirait deux
 * chemins vers la même géométrie. Cet écran porte ce qui manquait autour du
 * tracé : les propriétés des arêtes, les points de décision calculés et les
 * anomalies du graphe.
 */
export function GraphView({ onNavigate }: GraphViewProps): JSX.Element {
  const site = useSiteData();
  const { t } = useI18n();
  const profile = site.travel_profiles[0];
  const [levelId, setLevelId] = useState('');

  const levels = useMemo(
    () => [...site.levels].sort((a, b) => a.ordinal - b.ordinal),
    [site],
  );

  const graphFindings = useMemo<readonly Finding[]>(() => {
    const result = validateGraph(site);
    return result.ok ? result.warnings : result.findings;
  }, [site]);

  const decisionPoints = useMemo(() => {
    if (profile === undefined) return null;
    const result = deriveDecisionPoints(site, profile, site.destinations);
    return result.ok ? result.value : null;
  }, [site, profile]);

  const nodeLevel = useMemo(
    () => new Map(site.graph.nodes.map(n => [n.id, n.level_id])),
    [site],
  );
  const nodeLabel = useMemo(
    () => new Map(site.graph.nodes.map(n => [n.id, n.label.length > 0 ? n.label : n.id])),
    [site],
  );

  const kindCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const node of site.graph.nodes) {
      if (levelId !== '' && node.level_id !== levelId) continue;
      counts.set(node.kind, (counts.get(node.kind) ?? 0) + 1);
    }
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [site, levelId]);

  const edgeRows = useMemo<readonly EdgeRow[]>(() =>
    [...site.graph.edges]
      .filter(edge => levelId === ''
        || nodeLevel.get(edge.from_node_id) === levelId
        || nodeLevel.get(edge.to_node_id) === levelId)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((edge): EdgeRow => ({
        edge,
        from: nodeLabel.get(edge.from_node_id) ?? edge.from_node_id,
        to: nodeLabel.get(edge.to_node_id) ?? edge.to_node_id,
        crossLevel: nodeLevel.get(edge.from_node_id) !== nodeLevel.get(edge.to_node_id),
      })), [site, levelId, nodeLevel, nodeLabel]);

  const accessible = site.graph.edges.filter(e => e.accessible).length;
  const evacuation = site.graph.edges.filter(e => e.evacuation_route).length;

  const metrics: readonly Metric[] = [
    { id: 'nodes', label: t('graph.metric.nodes'), value: String(site.graph.nodes.length) },
    { id: 'edges', label: t('graph.metric.edges'), value: String(site.graph.edges.length) },
    { id: 'accessible', label: t('graph.metric.accessible'), value: String(accessible) },
    { id: 'evacuation', label: t('graph.metric.evacuation'), value: String(evacuation) },
    { id: 'vertical', label: t('graph.metric.vertical'), value: String(site.graph.vertical_links.length) },
    {
      id: 'decision',
      label: t('graph.metric.decision'),
      value: decisionPoints === null ? '—' : String(decisionPoints.length),
    },
  ];

  const columns: readonly Column<EdgeRow>[] = [
    { id: 'id', header: t('graph.col.edge'), cell: r => r.edge.id },
    { id: 'from', header: t('graph.col.from'), cell: r => r.from },
    { id: 'to', header: t('graph.col.to'), cell: r => r.to },
    {
      id: 'width',
      header: t('graph.col.width'),
      numeric: true,
      cell: r => r.edge.width_m.toFixed(2),
    },
    {
      id: 'direction',
      header: t('graph.col.direction'),
      cell: r => t(DIRECTION_KEYS[r.edge.direction]),
    },
    {
      id: 'accessible',
      header: t('graph.col.accessible'),
      cell: r => (
        <Tag
          label={r.edge.accessible ? t('graph.yes') : t('graph.no')}
          severity={r.edge.accessible ? 'valid' : undefined}
          muted={!r.edge.accessible}
        />
      ),
    },
    {
      id: 'evacuation',
      header: t('graph.col.evacuation'),
      cell: r => (
        <Tag
          label={r.edge.evacuation_route ? t('graph.yes') : t('graph.no')}
          severity={r.edge.evacuation_route ? 'info' : undefined}
          muted={!r.edge.evacuation_route}
        />
      ),
    },
    {
      id: 'cross',
      header: t('graph.col.crosslevel'),
      cell: r => (
        r.crossLevel
          ? <Tag label={t('graph.crosslevel')} severity="warning" />
          : null
      ),
    },
  ];

  return (
    <div>
      <ScreenHeader
        eyebrow={t('graph.eyebrow')}
        title={t('graph.title')}
        subtitle={t('graph.subtitle')}
        actions={[
          { id: 'atelier', label: t('graph.action.atelier'), onSelect: () => { onNavigate('editor'); } },
        ]}
      />

      <MetricRow metrics={metrics} />

      <div style={{ display: 'flex', gap: SPACE.md, alignItems: 'center', margin: `${String(SPACE.lg)}px 0 ${String(SPACE.sm)}px` }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, fontSize: TEXT.small }}>
          {t('graph.filter.level')}
          <select
            value={levelId}
            onChange={(e) => { setLevelId(e.target.value); }}
            style={{
              border: '1px solid var(--border-interactive)',
              background: 'var(--surface-panel)',
              color: 'var(--text-primary)',
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: TEXT.small,
              fontFamily: 'inherit',
            }}
          >
            <option value="">{t('graph.filter.alllevels')}</option>
            {levels.map(level => (
              <option key={level.id} value={level.id}>{level.name}</option>
            ))}
          </select>
        </label>
      </div>

      <Panel title={t('graph.panel.edges')} note={String(edgeRows.length)} padded={false}>
        <DataTable columns={columns} rows={edgeRows} rowKey={r => r.edge.id} empty={t('graph.edges.empty')} />
      </Panel>

      <div style={{ marginTop: SPACE.lg }}>
        <PanelGrid min={280}>
          <Panel title={t('graph.panel.kinds')}>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: SPACE.xs }}>
              {kindCounts.map(([kind, count]) => (
                <li key={kind} style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.md, fontSize: TEXT.small }}>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{kind}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{String(count)}</span>
                </li>
              ))}
            </ul>
            <Note>{t('graph.kinds.note')}</Note>
          </Panel>

          <Panel title={t('graph.panel.decision')} note={decisionPoints === null ? '' : String(decisionPoints.length)}>
            {decisionPoints === null ? (
              <p style={{ margin: 0, fontSize: TEXT.small, color: 'var(--text-muted)' }}>
                {t('graph.decision.unavailable')}
              </p>
            ) : (
              <ul style={{
                margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: SPACE.xs,
                maxHeight: 200, overflow: 'auto',
              }}>
                {decisionPoints.map(point => (
                  <li key={point.node_id} style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.md, fontSize: TEXT.small }}>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                      {nodeLabel.get(point.node_id) ?? point.node_id}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      {t('graph.decision.branches', { count: point.branch_count })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Note>{t('graph.decision.note')}</Note>
          </Panel>

          <Panel title={t('graph.panel.findings')} note={String(graphFindings.length)}>
            <FindingList findings={graphFindings} empty={t('graph.findings.empty')} limit={10} />
          </Panel>
        </PanelGrid>
      </div>

      <Note>{t('graph.note')}</Note>
    </div>
  );
}

const DIRECTION_KEYS = {
  both: 'graph.direction.both',
  forward: 'graph.direction.forward',
  backward: 'graph.direction.backward',
} as const;
