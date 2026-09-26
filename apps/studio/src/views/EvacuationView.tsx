import { type JSX, useMemo, useState } from 'react';
import { auditEvacuation, checkEdgeAvailability } from '@azimut/engine-graph';
import { renderEvacuationPlan, type EvacuationStats } from '@azimut/engine-layout';
import type { Finding } from '@azimut/core-model';
import { useSiteData } from '../context/useSiteData.js';
import { useI18n } from '../i18n/useI18n.js';
import type { ViewId } from '../views.js';
import {
  ScreenHeader, MetricRow, Panel, PanelGrid, DataTable, Tag, Note, StateBanner, SPACE, TEXT,
  type Metric, type Column,
} from '../components/ui/index.js';
import { FindingList } from './message-schedule/FindingList.js';
import { siteLabels } from './register/labels.js';
import { formatNumber } from './register/format.js';
import { EVACUATION_PREVIEW_THEME, PLAN_PREVIEW_FONT_FAMILY } from './plans/plan-preview.js';

type EvacuationViewProps = {
  readonly onNavigate: (view: ViewId) => void;
};

type LevelPlan = {
  readonly levelId: string;
  readonly svg: string | null;
  readonly stats: EvacuationStats | null;
  readonly findings: readonly Finding[];
  /** Nœuds du niveau qu'aucun cheminement d'évacuation ne dessert. */
  readonly uncovered: number;
};

const PLAN_WIDTH = 720;
const PLAN_HEIGHT = 440;

/**
 * Module 04 — les plans d'évacuation (N4.3). Ils ne se dessinent pas : le
 * moteur les tire du graphe, niveau par niveau — sorties, cheminements
 * marqués d'évacuation, repères. L'écran rassemble ce que le moteur rend et
 * ce que l'audit d'évacuation relève.
 */
export function EvacuationView({ onNavigate }: EvacuationViewProps): JSX.Element {
  const site = useSiteData();
  const { t, lang } = useI18n();
  const labels = useMemo(() => siteLabels(site, lang), [site, lang]);
  const [levelId, setLevelId] = useState<string | null>(null);

  const uncoveredNodes = useMemo<readonly string[]>(() => {
    const audit = auditEvacuation(site);
    return audit.ok ? audit.value.uncovered_nodes : [];
  }, [site]);

  // A5.3 — le plan, imprimé et durable, ne voit pas les fermetures ; le
  // contrôle les montre, pour qu'une décision humaine soit prise sur la période.
  const closureFindings = useMemo(
    () => checkEdgeAvailability(site).filter(f => f.code === 'GRAPH.EVACUATION_EDGE_CLOSURE'),
    [site],
  );

  // T-2.10 : un plan d'évacuation ne se produit que sous un paquet de règles
  // rattaché. Sans lui, aucun rendu n'est tenté, pas même un aperçu.
  const bound = site.site.rules_pack_id !== null;

  const plans = useMemo<readonly LevelPlan[]>(() => (!bound ? [] : site.levels.map(level => {
    const rendered = renderEvacuationPlan(site, level.id, {
      width_px: PLAN_WIDTH,
      height_px: PLAN_HEIGHT,
      theme: EVACUATION_PREVIEW_THEME,
      font_family: PLAN_PREVIEW_FONT_FAMILY,
      padding_px: 24,
      viewer_position: null,
      show_non_evacuation: true,
    });
    return {
      levelId: level.id,
      svg: rendered.ok ? rendered.value.svg : null,
      stats: rendered.ok ? rendered.value.stats : null,
      findings: rendered.ok ? rendered.warnings : rendered.findings,
      uncovered: uncoveredNodes.filter(id => labels.nodeLevel(id) === level.id).length,
    };
  })), [site, uncoveredNodes, labels, bound]);

  const header = (
    <ScreenHeader
      title={t('evacuation.title')}
      subtitle={t('evacuation.subtitle')}
      actions={[{ id: 'graph', label: t('evacuation.action.graph'), onSelect: () => { onNavigate('graph'); } }]}
    />
  );

  if (!bound) {
    return (
      <div>
        {header}
        <StateBanner
          severity="blocking"
          message={t('evacuation.refused')}
          hint={t('evacuation.refused.hint')}
        />
        <Note>{t('evacuation.note')}</Note>
      </div>
    );
  }

  const selected = plans.find(p => p.levelId === levelId) ?? plans[0] ?? null;
  const exits = plans.reduce((n, p) => n + (p.stats?.exit_count ?? 0), 0);
  const length = plans.reduce((n, p) => n + (p.stats?.total_route_length_m ?? 0), 0);
  const toFix = plans.filter(p => p.svg === null || p.findings.length > 0 || (p.stats?.exit_count ?? 0) === 0).length;

  const metrics: readonly Metric[] = [
    { id: 'plans', label: t('evacuation.metric.plans'), value: String(plans.length) },
    { id: 'tofix', label: t('evacuation.metric.tofix'), value: String(toFix), severity: toFix > 0 ? 'warning' : 'valid' },
    { id: 'exits', label: t('evacuation.metric.exits'), value: String(exits) },
    { id: 'length', label: t('evacuation.metric.length'), value: `${formatNumber(length, lang, 1)} m` },
    {
      id: 'uncovered',
      label: t('evacuation.metric.uncovered'),
      value: String(uncoveredNodes.length),
      severity: uncoveredNodes.length > 0 ? 'warning' : 'valid',
    },
  ];

  const columns: readonly Column<LevelPlan>[] = [
    { id: 'level', header: t('placement.col.level'), cell: p => labels.level(p.levelId) },
    { id: 'exits', header: t('evacuation.metric.exits'), numeric: true, cell: p => String(p.stats?.exit_count ?? 0) },
    { id: 'routes', header: t('evacuation.col.routes'), numeric: true, cell: p => String(p.stats?.route_count ?? 0) },
    { id: 'length', header: t('evacuation.col.length'), numeric: true, cell: p => formatNumber(p.stats?.total_route_length_m ?? 0, lang, 2) },
    { id: 'uncovered', header: t('evacuation.metric.uncovered'), numeric: true, cell: p => String(p.uncovered) },
    {
      id: 'state',
      header: t('sitesheet.col.state'),
      cell: p => {
        if (p.svg === null) return <Tag label={t('evacuation.state.failed')} severity="blocking" />;
        if ((p.stats?.exit_count ?? 0) === 0) return <Tag label={t('evacuation.state.noexit')} severity="warning" />;
        if (p.findings.length > 0) return <Tag label={t('evacuation.state.warnings')} severity="warning" />;
        return <Tag label={t('evacuation.state.ok')} severity="valid" />;
      },
    },
  ];

  return (
    <div>
      {header}
      {closureFindings.length > 0 && (
        <div style={{ marginBottom: SPACE.lg }}>
          <StateBanner
            severity="warning"
            code="GRAPH.EVACUATION_EDGE_CLOSURE"
            message={t('evacuation.closures', { count: closureFindings.length })}
          >
            <FindingList findings={closureFindings} empty="" />
          </StateBanner>
        </div>
      )}
      <MetricRow metrics={metrics} />
      <div style={{ marginTop: SPACE.lg }}>
        <Panel title={t('evacuation.panel.levels')} note={String(plans.length)} padded={false}>
          <DataTable
            columns={columns}
            rows={plans}
            rowKey={p => p.levelId}
            empty={t('evacuation.none')}
            onSelect={p => { setLevelId(p.levelId); }}
            selectedKey={selected?.levelId}
          />
        </Panel>
      </div>
      {selected !== null && (
        <div style={{ marginTop: SPACE.lg }}>
          <PanelGrid min={360}>
            <Panel title={t('evacuation.panel.preview', { level: labels.level(selected.levelId) })}>
              {selected.svg !== null
                ? (
                  <div
                    className="az-svg-fit"
                    role="img"
                    aria-label={t('evacuation.preview.aria', { level: labels.level(selected.levelId) })}
                    style={{ border: '1px solid var(--border-hairline)', borderRadius: 4, overflow: 'hidden', maxWidth: PLAN_WIDTH }}
                    dangerouslySetInnerHTML={{ __html: selected.svg }}
                  />
                )
                : <FindingList findings={selected.findings} empty={t('evacuation.none')} />}
              <p style={{ margin: `${String(SPACE.sm)}px 0 0`, fontSize: TEXT.micro, color: 'var(--text-muted)' }}>
                {t('evacuation.preview.note')}
              </p>
            </Panel>
            <Panel title={t('evacuation.panel.findings')} note={String(selected.findings.length)}>
              <FindingList findings={selected.findings} empty={t('evacuation.none')} limit={20} />
            </Panel>
          </PanelGrid>
        </div>
      )}
      <Note>{t('evacuation.note')}</Note>
    </div>
  );
}
