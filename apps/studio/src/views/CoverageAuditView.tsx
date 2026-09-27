import { type JSX, useMemo, useState } from 'react';
import { auditCoverage, deriveDecisionPoints } from '@azimut/engine-graph';
import { useSiteData } from '../context/useSiteData.js';
import { useI18n } from '../i18n/useI18n.js';
import type { ViewId } from '../views.js';
import {
  ScreenHeader, MetricRow, Panel, PanelGrid, DataTable, Tag, Note, StateBanner, SelectField,
  SPACE, type Metric, type Column,
} from '../components/ui/index.js';
import { FindingList } from './message-schedule/FindingList.js';
import { siteLabels } from './register/labels.js';
import { formatNumber } from './register/format.js';

type CoverageAuditViewProps = {
  readonly onNavigate: (view: ViewId) => void;
};

type UncoveredRow = { readonly nodeId: string; readonly levelId: string | null; readonly branches: number };
type LevelRow = { readonly levelId: string; readonly points: number; readonly covered: number };

/**
 * Module 02 — l'audit de couverture du jalonnement (N2.6, N2.4).
 *
 * Tout vient du moteur `auditCoverage` : un point de décision est couvert
 * quand un support y est posé. Tant que le graphe ne passe pas sa validation
 * de complétude, aucun taux n'est publié (M02.W10) : l'écran montre le refus
 * et ses causes, pas un taux partiel.
 */
export function CoverageAuditView({ onNavigate }: CoverageAuditViewProps): JSX.Element {
  const site = useSiteData();
  const { t, lang } = useI18n();
  const labels = useMemo(() => siteLabels(site, lang), [site, lang]);
  const [profileId, setProfileId] = useState(site.travel_profiles[0]?.id ?? '');
  const profile = site.travel_profiles.find(p => p.id === profileId) ?? site.travel_profiles[0];

  const result = useMemo(
    () => (profile === undefined ? null : auditCoverage(site, profile, site.supports)),
    [site, profile],
  );
  const branches = useMemo(() => {
    if (profile === undefined) return new Map<string, number>();
    const points = deriveDecisionPoints(site, profile, site.destinations);
    return new Map(points.ok ? points.value.map(p => [p.node_id, p.branch_count]) : []);
  }, [site, profile]);

  const header = (
    <ScreenHeader
      title={t('coverage.title')}
      subtitle={t('coverage.subtitle')}
      actions={[{ id: 'staggering', label: t('coverage.action.staggering'), onSelect: () => { onNavigate('staggering'); } }]}
    >
      {site.travel_profiles.length > 1 && (
        <div style={{ width: 280 }}>
          <SelectField
            label={t('coverage.profile')}
            value={profile?.id ?? ''}
            options={site.travel_profiles.map(p => ({ value: p.id, label: p.name }))}
            onChange={setProfileId}
          />
        </div>
      )}
    </ScreenHeader>
  );

  if (profile === undefined || result === null) {
    return <div>{header}<StateBanner severity="warning" message={t('staggering.noprofile')} /></div>;
  }

  if (!result.ok) {
    return (
      <div>
        {header}
        <StateBanner severity="blocking" code="GRAPH.NOT_VALIDATED" message={t('coverage.refused')} hint={t('coverage.refused.hint')} />
        <div style={{ marginTop: SPACE.lg }}>
          <Panel title={t('coverage.panel.causes')} note={String(result.findings.length)}>
            <FindingList findings={result.findings} empty={t('coverage.none')} limit={20} />
          </Panel>
        </div>
      </div>
    );
  }

  const report = result.value;
  const uncoveredSet = new Set(report.uncovered_points);
  const uncovered: readonly UncoveredRow[] = report.uncovered_points.map(nodeId => ({
    nodeId, levelId: labels.nodeLevel(nodeId), branches: branches.get(nodeId) ?? 0,
  }));
  const byLevel: readonly LevelRow[] = site.levels
    .map(level => {
      const points = [...branches.keys()].filter(id => labels.nodeLevel(id) === level.id);
      return { levelId: level.id, points: points.length, covered: points.filter(id => !uncoveredSet.has(id)).length };
    })
    .filter(row => row.points > 0);
  const pct = (covered: number, total: number): string =>
    (total === 0 ? '—' : `${formatNumber((covered / total) * 100, lang, 1)} %`);

  const metrics: readonly Metric[] = [
    { id: 'points', label: t('coverage.metric.points'), value: String(report.total_decision_points) },
    { id: 'covered', label: t('coverage.metric.covered'), value: String(report.covered_decision_points), severity: 'valid' },
    {
      id: 'uncovered', label: t('coverage.metric.uncovered'), value: String(report.uncovered_points.length),
      severity: report.uncovered_points.length > 0 ? 'blocking' : 'valid',
    },
    {
      id: 'ratio', label: t('coverage.metric.ratio'),
      value: pct(report.covered_decision_points, report.total_decision_points),
      note: profile.name,
    },
  ];

  const uncoveredColumns: readonly Column<UncoveredRow>[] = [
    { id: 'point', header: t('coverage.col.point'), cell: r => labels.node(r.nodeId) },
    { id: 'level', header: t('placement.col.level'), cell: r => (r.levelId === null ? '—' : labels.level(r.levelId)) },
    { id: 'branches', header: t('coverage.col.branches'), numeric: true, cell: r => String(r.branches) },
    { id: 'severity', header: t('coverage.col.severity'), cell: () => <Tag label={t('coverage.severity.blocking')} severity="blocking" /> },
  ];
  const levelColumns: readonly Column<LevelRow>[] = [
    { id: 'level', header: t('placement.col.level'), cell: r => labels.level(r.levelId) },
    { id: 'points', header: t('coverage.metric.points'), numeric: true, cell: r => String(r.points) },
    { id: 'covered', header: t('coverage.metric.covered'), numeric: true, cell: r => String(r.covered) },
    { id: 'ratio', header: t('coverage.metric.ratio'), numeric: true, cell: r => pct(r.covered, r.points) },
  ];

  return (
    <div>
      {header}
      <MetricRow metrics={metrics} />
      <div style={{ marginTop: SPACE.lg }}>
        <PanelGrid min={360}>
          <Panel title={t('coverage.panel.uncovered')} note={String(uncovered.length)} padded={false}>
            <DataTable columns={uncoveredColumns} rows={uncovered} rowKey={r => r.nodeId} empty={t('coverage.none')} />
          </Panel>
          <Panel title={t('coverage.panel.levels')} note={String(byLevel.length)} padded={false}>
            <DataTable columns={levelColumns} rows={byLevel} rowKey={r => r.levelId} empty={t('coverage.none')} />
          </Panel>
        </PanelGrid>
      </div>
      <div style={{ marginTop: SPACE.lg }}>
        <Panel title={t('coverage.panel.findings')} note={String(report.findings.length)}>
          <FindingList findings={report.findings} empty={t('coverage.none')} limit={20} />
        </Panel>
      </div>
      <Note>{t('coverage.method')}</Note>
    </div>
  );
}
