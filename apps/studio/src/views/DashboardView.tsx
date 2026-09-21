import { type JSX, useMemo } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import { useSiteVocabulary } from '../context/useSiteVocabulary.js';
import { useI18n } from '../i18n/useI18n.js';
import { evaluatePublishGate } from '../publish-gate.js';
import type { Finding } from '@azimut/core-model';
import type { ViewId } from '../views.js';
import { guardPlacementBookings, auditOptionExpiry } from '../domain/ad-planning.js';
import { auditInstallReserves } from '../domain/install-reserves.js';
import { auditSurveySync } from '../domain/survey-sync.js';
import { DEMO_BOOKINGS, DEMO_OPTIONS } from '../domain/demo/commerce.js';
import { DEMO_RESERVES, DEMO_ROUNDS } from '../domain/demo/production.js';
import { PRODUCT_MODULES } from '../product-map.js';
import {
  ScreenHeader, MetricRow, Panel, PanelGrid, Note, Tag,
  SPACE, TEXT, severityColor, type Metric,
} from '../components/ui/index.js';
import { FindingList } from './message-schedule/FindingList.js';

type DashboardViewProps = {
  readonly onNavigate: (view: ViewId) => void;
};

function findingsOf(result: { ok: boolean; warnings?: Finding[]; findings?: Finding[] }): readonly Finding[] {
  return result.ok ? (result.warnings ?? []) : (result.findings ?? []);
}

type QueueEntry = {
  readonly id: string;
  readonly findings: readonly Finding[];
  readonly labelKey: 'dashboard.queue.foundation' | 'dashboard.queue.ads'
  | 'dashboard.queue.worksite' | 'dashboard.queue.operations';
  readonly view: ViewId;
};

/**
 * H10 — le tableau de bord ne montre que ce qui attend une action.
 *
 * Les compteurs de niveaux, de nœuds et de destinations appartiennent au
 * socle, pas ici : ce qui figure sur cet écran est ce qu'un utilisateur doit
 * traiter, chaque ligne menant à l'écran qui permet de le faire.
 */
export function DashboardView({ onNavigate }: DashboardViewProps): JSX.Element {
  const site = useSiteData();
  const vocabulary = useSiteVocabulary();
  const { t } = useI18n();
  const today = new Date().toISOString().slice(0, 10);

  const gate = useMemo(
    () => evaluatePublishGate(site, vocabulary),
    [site, vocabulary],
  );
  const siteFindings = gate.findings;

  const queues = useMemo<readonly QueueEntry[]>(() => {
    const bookings = guardPlacementBookings(DEMO_BOOKINGS);
    const options = auditOptionExpiry(DEMO_OPTIONS, today);
    const reserves = auditInstallReserves(DEMO_RESERVES.map(r => r.reserve));
    const surveys = auditSurveySync(DEMO_ROUNDS.map(r => r.survey));

    return [
      { id: 'foundation', findings: siteFindings, labelKey: 'dashboard.queue.foundation', view: 'foundation' },
      {
        id: 'ads',
        findings: [...findingsOf(bookings), ...findingsOf(options)],
        labelKey: 'dashboard.queue.ads',
        view: 'advertising',
      },
      { id: 'worksite', findings: findingsOf(reserves), labelKey: 'dashboard.queue.worksite', view: 'worksite' },
      { id: 'operations', findings: findingsOf(surveys), labelKey: 'dashboard.queue.operations', view: 'operations' },
    ];
  }, [siteFindings, today]);

  const all = queues.flatMap(q => q.findings);
  const blocking = all.filter(f => f.severity === 'blocking');
  const warnings = all.filter(f => f.severity === 'warning');
  const info = all.filter(f => f.severity === 'info');
  // Un vocabulaire non lu ne vaut pas un vocabulaire vide : tant qu'il manque,
  // la case ne passe pas au vert, et la note dit pourquoi plutôt que de laisser
  // croire à des anomalies qu'on n'a pas trouvées.
  //
  // Les bloquantes comptées ici dépassent celles du site : l'affichage, le
  // chantier et l'exploitation entrent dans le même total, et une seule suffit
  // à refuser. La porte, elle, ne connaît que le site.
  const vocabReady = gate.vocabularyRefusal === 'none';
  const publishable = blocking.length === 0 && vocabReady;

  const metrics: readonly Metric[] = [
    {
      id: 'blocking',
      label: t('dashboard.metric.blocking'),
      value: String(blocking.length),
      note: t('dashboard.metric.blocking.note'),
      severity: blocking.length > 0 ? 'blocking' : 'valid',
    },
    { id: 'warnings', label: t('dashboard.metric.warnings'), value: String(warnings.length), severity: 'warning' },
    { id: 'info', label: t('dashboard.metric.info'), value: String(info.length), severity: 'info' },
    {
      id: 'publishable',
      label: t('dashboard.metric.publishable'),
      value: publishable ? t('dashboard.publishable.yes') : t('dashboard.publishable.no'),
      ...(publishable
        ? {}
        : {
            note: vocabReady
              ? t('dashboard.publishable.note', { count: blocking.length })
              : t('dashboard.publishable.vocab', { status: gate.vocabularyRefusal }),
          }),
      severity: publishable ? 'valid' : 'blocking',
    },
    {
      id: 'modules',
      label: t('dashboard.metric.modules'),
      value: String(PRODUCT_MODULES.filter(m => m.engine !== 'absent').length),
      note: t('dashboard.metric.modules.note', { total: PRODUCT_MODULES.length }),
    },
  ];

  return (
    <div>
      <ScreenHeader
        eyebrow={t('dashboard.eyebrow')}
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
      >
        <span style={{ fontSize: TEXT.small, color: 'var(--text-secondary)' }}>
          {`${site.site.name} — ${site.organization.name}`}
        </span>
      </ScreenHeader>

      <MetricRow metrics={metrics} />

      <div style={{ marginTop: SPACE.lg }}>
        <PanelGrid min={320}>
          {queues.map(queue => (
            <Panel
              key={queue.id}
              title={t(queue.labelKey)}
              note={String(queue.findings.length)}
            >
              <FindingList
                findings={[...queue.findings].sort(bySeverity)}
                empty={t('dashboard.queue.empty')}
                limit={5}
              />
              <button
                type="button"
                onClick={() => { onNavigate(queue.view); }}
                style={{
                  marginTop: SPACE.md,
                  border: '1px solid var(--border-interactive)',
                  background: 'var(--surface-panel)',
                  color: 'var(--text-primary)',
                  borderRadius: 4,
                  padding: '4px 12px',
                  fontSize: TEXT.small,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                {t('dashboard.queue.open')}
              </button>
            </Panel>
          ))}
        </PanelGrid>
      </div>

      <div style={{ marginTop: SPACE.lg }}>
        <Panel title={t('dashboard.panel.severity')} note={String(all.length)}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE.sm }}>
            <Tag label={t('dashboard.tag.blocking', { count: blocking.length })} severity="blocking" />
            <Tag label={t('dashboard.tag.warning', { count: warnings.length })} severity="warning" />
            <Tag label={t('dashboard.tag.info', { count: info.length })} severity="info" />
          </div>
          <div style={{
            marginTop: SPACE.md,
            height: 6,
            borderRadius: 4,
            display: 'flex',
            overflow: 'hidden',
            background: 'var(--surface-sunken)',
          }}>
            {([
              ['blocking', blocking.length],
              ['warning', warnings.length],
              ['info', info.length],
            ] as const).map(([severity, count]) => (
              <div
                key={severity}
                style={{
                  width: `${String(all.length === 0 ? 0 : (count / all.length) * 100)}%`,
                  background: severityColor(severity),
                }}
              />
            ))}
          </div>
          <Note>{t('dashboard.panel.severity.note')}</Note>
        </Panel>
      </div>

      <Note>{t('dashboard.note')}</Note>
    </div>
  );
}

const SEVERITY_RANK: Readonly<Record<string, number>> = {
  blocking: 0,
  warning: 1,
  info: 2,
};

function bySeverity(a: Finding, b: Finding): number {
  return (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3)
    || a.code.localeCompare(b.code);
}
