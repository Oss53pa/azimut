import { type JSX, useMemo } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import { useI18n } from '../i18n/useI18n.js';
import {
  auditCoverage, auditAccessibility, auditEvacuation,
  computeQuantities, computeInputsHash,
  runChecks, validateGraph, validateGeometry, validateDirectory,
} from '@azimut/engine-graph';
import type { Finding } from '@azimut/core-model';
import type { ViewId } from '../views.js';
import { placedSupports } from '../domain/trial-placement.js';
import {
  ScreenHeader, MetricRow, Panel, PanelGrid, DataTable, Note, Tag,
  SPACE, TEXT, type Metric, type Column, type ScreenAction,
} from '../components/ui/index.js';
import { FindingList } from './message-schedule/FindingList.js';
import { UntypedSupportsBanner } from './signage/UntypedSupportsBanner.js';

type FoundationViewProps = {
  readonly onNavigate: (view: ViewId) => void;
};

type LevelRow = {
  readonly id: string;
  readonly name: string;
  readonly ordinal: number;
  readonly building: string;
  readonly nodes: number;
  readonly footprints: number;
  readonly destinations: number;
};

function findingsOf(result: { ok: boolean; warnings?: Finding[]; findings?: Finding[] }): readonly Finding[] {
  return result.ok ? (result.warnings ?? []) : (result.findings ?? []);
}

function ratio(part: number, whole: number): string {
  return `${String(part)} / ${String(whole)}`;
}

/**
 * Module 01 — le socle du site. Graphe, destinations, supports, plans de
 * niveaux, contrôles de complétude. Tous les compteurs sont calculés depuis
 * les données du site ; aucun n'est stocké (invariant 1).
 */
export function FoundationView({ onNavigate }: FoundationViewProps): JSX.Element {
  const site = useSiteData();
  const { t } = useI18n();
  const profile = site.travel_profiles[0];

  const report = useMemo(() => {
    const findings: Finding[] = [];
    const checks = runChecks(site);
    findings.push(...(checks.ok ? checks.value.findings : checks.findings));
    findings.push(...findingsOf(validateGraph(site)));
    findings.push(...findingsOf(validateGeometry(site)));
    findings.push(...findingsOf(validateDirectory(site)));

    const coverage = profile === undefined ? null : auditCoverage(site, profile, site.supports);
    // N2.4 — les anomalies de couverture sont nommées par leur code comme les
    // autres : elles rejoignent la liste au lieu de rester dans un compteur.
    if (coverage !== null && coverage.ok) findings.push(...coverage.value.findings);
    const access = profile === undefined ? null : auditAccessibility(site, profile);
    const evac = auditEvacuation(site);
    const quantities = computeQuantities(site, placedSupports(site, site.support_types[0]?.key ?? ''));

    return {
      findings,
      coverage: coverage !== null && coverage.ok ? coverage.value : null,
      access: access !== null && access.ok ? access.value : null,
      evacuation: evac.ok ? evac.value : null,
      quantities: quantities.ok ? quantities.value : null,
      inputsHash: profile === undefined ? '' : computeInputsHash(site, profile),
    };
  }, [site, profile]);

  const levelRows = useMemo<readonly LevelRow[]>(() => {
    const buildingNames = new Map(site.buildings.map(b => [b.id, b.name]));
    const destinationLevel = new Map<string, string>();
    for (const node of site.graph.nodes) destinationLevel.set(node.id, node.level_id);

    return [...site.levels]
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((level): LevelRow => ({
        id: level.id,
        name: level.name,
        ordinal: level.ordinal,
        building: buildingNames.get(level.building_id) ?? level.building_id,
        nodes: site.graph.nodes.filter(n => n.level_id === level.id).length,
        footprints: site.footprints.filter(f => f.level_id === level.id).length,
        destinations: site.destinations.filter(
          d => destinationLevel.get(d.node_id) === level.id,
        ).length,
      }));
  }, [site]);

  const blocking = report.findings.filter(f => f.severity === 'blocking');

  const metrics: readonly Metric[] = [
    { id: 'levels', label: t('foundation.metric.levels'), value: String(site.levels.length) },
    { id: 'nodes', label: t('foundation.metric.nodes'), value: String(site.graph.nodes.length) },
    { id: 'edges', label: t('foundation.metric.edges'), value: String(site.graph.edges.length) },
    { id: 'footprints', label: t('foundation.metric.footprints'), value: String(site.footprints.length) },
    { id: 'destinations', label: t('foundation.metric.destinations'), value: String(site.destinations.length) },
    {
      id: 'blocking',
      label: t('foundation.metric.blocking'),
      value: String(blocking.length),
      severity: blocking.length > 0 ? 'blocking' : 'valid',
    },
  ];

  const actions: readonly ScreenAction[] = [
    { id: 'plan', label: t('foundation.action.plan'), onSelect: () => { onNavigate('floor-plans'); } },
    { id: 'checks', label: t('foundation.action.checks'), primary: true, onSelect: () => { onNavigate('checks'); } },
  ];

  const levelColumns: readonly Column<LevelRow>[] = [
    { id: 'ordinal', header: t('foundation.col.ordinal'), numeric: true, cell: r => String(r.ordinal) },
    { id: 'name', header: t('foundation.col.level'), cell: r => r.name },
    { id: 'building', header: t('foundation.col.building'), cell: r => r.building },
    { id: 'nodes', header: t('foundation.col.nodes'), numeric: true, cell: r => String(r.nodes) },
    { id: 'footprints', header: t('foundation.col.footprints'), numeric: true, cell: r => String(r.footprints) },
    { id: 'destinations', header: t('foundation.col.destinations'), numeric: true, cell: r => String(r.destinations) },
  ];

  return (
    <div>
      <ScreenHeader
        eyebrow={t('foundation.eyebrow')}
        title={t('foundation.title')}
        subtitle={t('foundation.subtitle')}
        actions={actions}
      />

      <UntypedSupportsBanner assumedTypeKey={site.support_types[0]?.key ?? ''} />
      <MetricRow metrics={metrics} />

      <div style={{ marginTop: SPACE.lg }}>
        <Panel title={t('foundation.panel.levels')} note={t('foundation.panel.levels.note')} padded={false}>
          <DataTable
            columns={levelColumns}
            rows={levelRows}
            rowKey={r => r.id}
            empty={t('foundation.levels.empty')}
          />
        </Panel>
      </div>

      <div style={{ marginTop: SPACE.lg }}>
        <PanelGrid min={280}>
          <Panel title={t('foundation.panel.completeness')}>
            <dl style={{ margin: 0, display: 'grid', gap: SPACE.sm }}>
              <CompletenessRow
                label={t('foundation.completeness.coverage')}
                value={report.coverage === null
                  ? t('foundation.notcomputed')
                  : ratio(report.coverage.covered_decision_points, report.coverage.total_decision_points)}
              />
              <CompletenessRow
                label={t('foundation.completeness.reachable')}
                value={report.access === null
                  ? t('foundation.notcomputed')
                  : ratio(report.access.reachable_destinations, report.access.total_destinations)}
              />
              <CompletenessRow
                label={t('foundation.completeness.evacuation')}
                value={report.evacuation === null
                  ? t('foundation.notcomputed')
                  : ratio(report.evacuation.nodes_with_evacuation_route, report.evacuation.total_nodes)}
              />
              <CompletenessRow
                label={t('foundation.completeness.verticallinks')}
                value={String(site.graph.vertical_links.length)}
              />
              <CompletenessRow
                label={t('foundation.completeness.faces')}
                value={report.quantities === null
                  ? t('foundation.notcomputed')
                  : String(report.quantities.total_faces)}
              />
            </dl>
            <Note>{t('foundation.completeness.note')}</Note>
          </Panel>

          <Panel title={t('foundation.panel.declarations')}>
            <dl style={{ margin: 0, display: 'grid', gap: SPACE.sm }}>
              <CompletenessRow
                label={t('foundation.declarations.langs')}
                value={site.site.active_langs.length === 0
                  ? t('foundation.declarations.undeclared')
                  : site.site.active_langs.join(' · ')}
              />
              <CompletenessRow
                label={t('foundation.declarations.elevation')}
                value={site.site.reference_elevation_m === undefined
                  ? t('foundation.declarations.unsurveyed')
                  : `${site.site.reference_elevation_m.toFixed(2)} m`}
              />
              <CompletenessRow
                label={t('foundation.declarations.hours')}
                value={ratio(
                  site.buildings.filter(b => b.opening_hours !== undefined).length,
                  site.buildings.length,
                )}
              />
              <CompletenessRow
                label={t('foundation.declarations.edgewidth')}
                value={ratio(
                  site.buildings.filter(b => b.default_edge_width_m !== undefined).length,
                  site.buildings.length,
                )}
              />
              <CompletenessRow
                label={t('foundation.declarations.validity')}
                value={ratio(
                  site.destinations.filter(d => d.valid_from !== undefined).length,
                  site.destinations.length,
                )}
              />
            </dl>
            <Note>{t('foundation.declarations.note')}</Note>
          </Panel>

          <Panel title={t('foundation.panel.anomalies')} note={String(report.findings.length)}>
            <FindingList
              findings={report.findings}
              empty={t('foundation.anomalies.empty')}
              limit={10}
            />
          </Panel>

          <Panel title={t('foundation.panel.trace')}>
            <dl style={{ margin: 0, display: 'grid', gap: SPACE.sm }}>
              <CompletenessRow
                label={t('foundation.trace.hash')}
                value={report.inputsHash === '' ? t('foundation.notcomputed') : report.inputsHash.slice(0, 16)}
              />
              <CompletenessRow label={t('foundation.trace.organization')} value={site.organization.name} />
              <CompletenessRow label={t('foundation.trace.country')} value={site.site.country_code} />
              <CompletenessRow
                label={t('foundation.trace.rulespack')}
                value={site.site.rules_pack_id ?? t('foundation.trace.nopack')}
              />
            </dl>
            <div style={{ marginTop: SPACE.sm }}>
              <Tag
                label={site.site.rules_pack_id === null ? t('foundation.trace.unbound') : t('foundation.trace.bound')}
                severity={site.site.rules_pack_id === null ? 'warning' : 'valid'}
              />
            </div>
          </Panel>
        </PanelGrid>
      </div>

      <Note>{t('foundation.note')}</Note>
    </div>
  );
}

type CompletenessRowProps = {
  readonly label: string;
  readonly value: string;
};

function CompletenessRow({ label, value }: CompletenessRowProps): JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.md, alignItems: 'baseline' }}>
      <dt style={{ fontSize: TEXT.small, color: 'var(--text-secondary)' }}>{label}</dt>
      <dd style={{
        margin: 0,
        fontFamily: 'var(--font-mono)',
        fontVariantNumeric: 'tabular-nums',
        fontSize: TEXT.small,
        color: 'var(--text-primary)',
      }}>
        {value}
      </dd>
    </div>
  );
}
