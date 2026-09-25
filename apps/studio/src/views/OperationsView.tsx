import { type JSX, useMemo } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import { useI18n } from '../i18n/useI18n.js';
import { auditSurveySync } from '../domain/survey-sync.js';
import {
  DEMO_ROUNDS, DEMO_OBSERVATIONS,
  type InspectionRound, type FieldObservation,
} from '../domain/demo/production.js';
import {
  ScreenHeader, MetricRow, Panel, PanelGrid, DataTable, Tag, Note, StateBanner,
  SPACE, TEXT, type Metric, type Column,
} from '../components/ui/index.js';
import { FindingList } from './message-schedule/FindingList.js';
import { divergenceReport } from './operations/divergence.js';
import { natureKey } from './operations/labels.js';

/**
 * Module 08 — l'exploitation. La couche de divergence naît du rapprochement
 * entre ce que le carnet prévoit et ce qu'une tournée relève. Une tournée non
 * synchronisée est visible mais pas intégrée : elle ne disparaît pas en
 * silence.
 */
export function OperationsView(): JSX.Element {
  const site = useSiteData();
  const { t } = useI18n();
  const profile = site.travel_profiles[0];

  const syncFindings = useMemo(() => {
    const result = auditSurveySync(DEMO_ROUNDS.map(r => r.survey));
    return result.ok ? result.warnings : result.findings;
  }, []);

  const divergence = useMemo(
    () => (profile === undefined ? null : divergenceReport(site, profile)),
    [site, profile],
  );

  const pendingRounds = DEMO_ROUNDS.filter(r => r.survey.sync_state === 'pending');
  const blockingObservations = DEMO_OBSERVATIONS.filter(o => o.severity === 'blocking');

  const metrics: readonly Metric[] = [
    { id: 'tracked', label: t('operations.metric.tracked'), value: String(site.supports.length) },
    { id: 'rounds', label: t('operations.metric.rounds'), value: String(DEMO_ROUNDS.length) },
    {
      id: 'pending',
      label: t('operations.metric.pending'),
      value: String(pendingRounds.length),
      severity: pendingRounds.length > 0 ? 'warning' : 'valid',
    },
    { id: 'observations', label: t('operations.metric.observations'), value: String(DEMO_OBSERVATIONS.length) },
    {
      id: 'blocking',
      label: t('operations.metric.blocking'),
      value: String(blockingObservations.length),
      severity: blockingObservations.length > 0 ? 'blocking' : 'valid',
    },
  ];

  const roundColumns: readonly Column<InspectionRound>[] = [
    { id: 'id', header: t('operations.col.round'), cell: r => r.survey.id },
    { id: 'zone', header: t('operations.col.zone'), cell: r => r.zone },
    { id: 'date', header: t('operations.col.surveyed'), cell: r => r.surveyed_on ?? t('operations.round.planned') },
    { id: 'surveyor', header: t('operations.col.surveyor'), cell: r => r.surveyor ?? '—' },
    { id: 'count', header: t('operations.col.observations'), numeric: true, cell: r => String(r.observation_count) },
    {
      id: 'sync',
      header: t('operations.col.sync'),
      cell: r => (
        <Tag
          label={r.survey.sync_state === 'synced' ? t('operations.sync.synced') : t('operations.sync.pending')}
          severity={r.survey.sync_state === 'synced' ? 'valid' : 'warning'}
        />
      ),
    },
  ];

  const observationColumns: readonly Column<FieldObservation>[] = [
    { id: 'id', header: t('operations.col.observation'), cell: o => o.id },
    { id: 'support', header: t('operations.col.support'), cell: o => o.support_id },
    { id: 'nature', header: t('operations.col.nature'), cell: o => t(natureKey(o.nature_key)) },
    { id: 'round', header: t('operations.col.round'), cell: o => o.round_id },
    {
      id: 'severity',
      header: t('operations.col.severity'),
      cell: o => (
        <Tag
          label={o.severity === 'blocking' ? t('severity.blocking') : t('severity.warning')}
          severity={o.severity}
        />
      ),
    },
  ];

  return (
    <div>
      <ScreenHeader
        eyebrow={t('operations.eyebrow')}
        title={t('operations.title')}
        subtitle={t('operations.subtitle')}
      />

      <div style={{ display: 'grid', gap: SPACE.sm, marginBottom: SPACE.md }}>
        <StateBanner severity="info" message={t('demo.dataset.message')} hint={t('demo.dataset.hint')} />
        {pendingRounds.length > 0 && (
          <StateBanner
            severity="warning"
            code="SURVEY.SYNC_PENDING"
            message={t('operations.pending.message', { count: pendingRounds.length })}
          />
        )}
      </div>

      <MetricRow metrics={metrics} />

      <div style={{ marginTop: SPACE.lg }}>
        <Panel title={t('operations.panel.rounds')} padded={false}>
          <DataTable columns={roundColumns} rows={DEMO_ROUNDS} rowKey={r => r.survey.id} empty={t('operations.rounds.empty')} />
        </Panel>
      </div>

      <div style={{ marginTop: SPACE.lg }}>
        <Panel title={t('operations.panel.observations')} padded={false}>
          <DataTable
            columns={observationColumns}
            rows={DEMO_OBSERVATIONS}
            rowKey={o => o.id}
            empty={t('operations.observations.empty')}
          />
        </Panel>
      </div>

      <div style={{ marginTop: SPACE.lg }}>
        <PanelGrid min={300}>
          <Panel title={t('operations.panel.divergence')} note={t('operations.panel.divergence.note')}>
            {divergence === null ? (
              <p style={{ margin: 0, fontSize: TEXT.small, color: 'var(--text-muted)' }}>
                {t('operations.divergence.unavailable')}
              </p>
            ) : (
              <dl style={{ margin: 0, display: 'grid', gap: SPACE.xs, fontSize: TEXT.small }}>
                <DivergenceRow label={t('operations.divergence.superfluous')} value={String(divergence.superfluous_count)} />
                <DivergenceRow label={t('operations.divergence.uncovered')} value={String(divergence.uncovered_count)} />
                <DivergenceRow label={t('operations.divergence.orientation')} value={String(divergence.orientation_count)} />
                <DivergenceRow label={t('operations.divergence.undersized')} value={String(divergence.undersized_count)} />
              </dl>
            )}
            <Note>{t('operations.divergence.explain')}</Note>
          </Panel>

          <Panel title={t('operations.panel.sync')}>
            <FindingList findings={syncFindings} empty={t('operations.sync.empty')} />
          </Panel>
        </PanelGrid>
      </div>

      <Note>{t('operations.note')}</Note>
    </div>
  );
}

type DivergenceRowProps = {
  readonly label: string;
  readonly value: string;
};

function DivergenceRow({ label, value }: DivergenceRowProps): JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.md }}>
      <dt style={{ color: 'var(--text-secondary)' }}>{label}</dt>
      <dd style={{ margin: 0, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{value}</dd>
    </div>
  );
}
