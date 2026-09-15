import { type JSX, useMemo } from 'react';
import { runChecks, validateGraph, validateGeometry, validateDirectory } from '@azimut/engine-graph';
import { getErrorMessage } from '@azimut/core-model';
import type { SiteData, Finding, ErrorCode } from '@azimut/core-model';
import { useI18n } from '../i18n/useI18n.js';
import { appRepository, useAllSites } from '../data/index.js';
import {
  ScreenHeader, MetricRow, Panel, DataTable, Tag, Note, StateBanner,
  SPACE, type Metric, type Column,
} from '../components/ui/index.js';

type PortfolioViewProps = {
  readonly currentKey: string;
  readonly onOpenSite: (key: string) => void;
};

type SiteLine = {
  readonly key: string;
  readonly name: string;
  readonly organization: string;
  readonly country: string;
  readonly levels: number;
  readonly supports: number;
  readonly destinations: number;
  readonly blocking: number;
  readonly warnings: number;
  readonly conformity: number;
  readonly rulesPack: string | null;
};

function findingsOf(result: { ok: boolean; warnings?: Finding[]; findings?: Finding[] }): readonly Finding[] {
  return result.ok ? (result.warnings ?? []) : (result.findings ?? []);
}

function auditSite(site: SiteData): readonly Finding[] {
  const checks = runChecks(site);
  return [
    ...(checks.ok ? checks.value.findings : checks.findings),
    ...findingsOf(validateGraph(site)),
    ...findingsOf(validateGeometry(site)),
    ...findingsOf(validateDirectory(site)),
  ];
}

/**
 * Module 10 — le portefeuille.
 *
 * Il n'y a pas de moteur de portefeuille : ce que cet écran montre, ce sont
 * les mêmes contrôles exécutés site par site, rassemblés. Rien n'est consolidé
 * au delà de ce que ces contrôles rendent — et les chartes de groupe, l'héritage
 * et la comparaison restent à construire ; l'écran le dit plutôt que de les
 * faire semblant.
 */
export function PortfolioView({ currentKey, onOpenSite }: PortfolioViewProps): JSX.Element {
  const { t, lang } = useI18n();
  const repository = useMemo(() => appRepository(), []);
  const { state, loaded, total } = useAllSites(repository);

  const lines = useMemo<readonly SiteLine[]>(() => {
    if (state.status !== 'ready') return [];
    const out: SiteLine[] = [];
    for (const { id: key, data: site } of state.value) {
      const findings = auditSite(site);
      const blocking = findings.filter(f => f.severity === 'blocking').length;
      const checkedEntities = site.graph.nodes.length + site.footprints.length + site.destinations.length;
      out.push({
        key,
        name: site.site.name,
        organization: site.organization.name,
        country: site.site.country_code,
        levels: site.levels.length,
        supports: site.supports.length,
        destinations: site.destinations.length,
        blocking,
        warnings: findings.filter(f => f.severity === 'warning').length,
        conformity: checkedEntities === 0
          ? 0
          : Math.max(0, Math.round((1 - blocking / checkedEntities) * 100)),
        rulesPack: site.site.rules_pack_id,
      });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [state]);

  const totals = lines.reduce(
    (acc, line) => ({
      levels: acc.levels + line.levels,
      supports: acc.supports + line.supports,
      destinations: acc.destinations + line.destinations,
      blocking: acc.blocking + line.blocking,
    }),
    { levels: 0, supports: 0, destinations: 0, blocking: 0 },
  );

  const metrics: readonly Metric[] = [
    { id: 'sites', label: t('portfolio.metric.sites'), value: String(lines.length) },
    { id: 'levels', label: t('portfolio.metric.levels'), value: String(totals.levels) },
    { id: 'supports', label: t('portfolio.metric.supports'), value: String(totals.supports) },
    { id: 'destinations', label: t('portfolio.metric.destinations'), value: String(totals.destinations) },
    {
      id: 'blocking',
      label: t('portfolio.metric.blocking'),
      value: String(totals.blocking),
      severity: totals.blocking > 0 ? 'blocking' : 'valid',
    },
  ];

  const columns: readonly Column<SiteLine>[] = [
    { id: 'name', header: t('portfolio.col.site'), cell: l => l.name },
    { id: 'org', header: t('portfolio.col.organization'), cell: l => l.organization },
    { id: 'country', header: t('portfolio.col.country'), cell: l => l.country },
    { id: 'levels', header: t('portfolio.col.levels'), numeric: true, cell: l => String(l.levels) },
    { id: 'supports', header: t('portfolio.col.supports'), numeric: true, cell: l => String(l.supports) },
    {
      id: 'conformity',
      header: t('portfolio.col.conformity'),
      numeric: true,
      cell: l => `${String(l.conformity)} %`,
    },
    {
      id: 'blocking',
      header: t('portfolio.col.blocking'),
      numeric: true,
      cell: l => <Tag label={String(l.blocking)} severity={l.blocking > 0 ? 'blocking' : 'valid'} />,
    },
    {
      id: 'pack',
      header: t('portfolio.col.rulespack'),
      cell: l => l.rulesPack ?? t('portfolio.nopack'),
    },
    {
      id: 'open',
      header: t('portfolio.col.action'),
      cell: l => (
        <button
          type="button"
          onClick={() => { onOpenSite(l.key); }}
          style={{
            border: '1px solid var(--border-interactive)',
            background: 'var(--surface-panel)',
            color: 'var(--text-primary)',
            borderRadius: 4,
            padding: '2px 8px',
            fontSize: 11,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          {l.key === currentKey ? t('portfolio.action.current') : t('portfolio.action.open')}
        </button>
      ),
    },
  ];

  return (
    <div>
      <ScreenHeader
        eyebrow={t('portfolio.eyebrow')}
        title={t('portfolio.title')}
        subtitle={t('portfolio.subtitle')}
      />

      <div style={{ display: 'grid', gap: SPACE.sm, marginBottom: SPACE.md }}>
        <StateBanner
          severity="warning"
          message={t('portfolio.noengine.message')}
          hint={t('portfolio.noengine.hint')}
        />
        {state.status === 'loading' && (
          <StateBanner
            severity="info"
            message={t('portfolio.loading', { loaded, total })}
          />
        )}
        {state.status === 'failed' && (
          <StateBanner
            severity="blocking"
            code={state.error.code}
            message={getErrorMessage(state.error.code as ErrorCode, lang) ?? state.error.code}
            hint={state.error.detail}
          />
        )}
      </div>

      <MetricRow metrics={metrics} />

      <div style={{ marginTop: SPACE.lg }}>
        <Panel title={t('portfolio.panel.sites')} note={t('portfolio.panel.sites.note')} padded={false}>
          <DataTable
            columns={columns}
            rows={lines}
            rowKey={l => l.key}
            selectedKey={currentKey}
            empty={t('portfolio.empty')}
          />
        </Panel>
      </div>

      <div style={{ marginTop: SPACE.lg }}>
        <Panel title={t('portfolio.panel.tobuild')}>
          <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: SPACE.xs, fontSize: 12, color: 'var(--text-secondary)' }}>
            <li>{t('portfolio.tobuild.charters')}</li>
            <li>{t('portfolio.tobuild.libraries')}</li>
            <li>{t('portfolio.tobuild.consolidation')}</li>
            <li>{t('portfolio.tobuild.comparison')}</li>
          </ul>
          <Note>{t('portfolio.tobuild.note')}</Note>
        </Panel>
      </div>

      <Note>{t('portfolio.note')}</Note>
    </div>
  );
}
