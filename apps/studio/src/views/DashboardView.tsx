import { type JSX, useMemo } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import { useI18n } from '../i18n/useI18n.js';
import { runChecks, validateGraph, validateGeometry, validateDirectory } from '@azimut/engine-graph';

function outcomeFindings(result: { ok: boolean; warnings?: unknown[]; findings?: unknown[] }): number {
  if (result.ok && 'warnings' in result) return (result.warnings as unknown[]).length;
  if (!result.ok && 'findings' in result) return (result.findings as unknown[]).length;
  return 0;
}

export function DashboardView(): JSX.Element {
  const site = useSiteData();
  const { t } = useI18n();

  const stats = useMemo(() => {
    const checkResult = runChecks(site);
    const graphResult = validateGraph(site);
    const geomResult = validateGeometry(site);
    const dirResult = validateDirectory(site);
    const checkFindings = checkResult.ok ? checkResult.value.findings.length : 0;
    const graphFindings = outcomeFindings(graphResult);
    const geomFindings = outcomeFindings(geomResult);
    const dirFindings = outcomeFindings(dirResult);

    return {
      levels: site.levels.length,
      nodes: site.graph.nodes.length,
      edges: site.graph.edges.length,
      destinations: site.destinations.length,
      supportTypes: site.support_types.length,
      templates: site.face_templates.length,
      findings: checkFindings + graphFindings + geomFindings + dirFindings,
    };
  }, [site]);

  const cards: readonly { label: string; value: string; warn?: boolean }[] = [
    { label: t('dashboard.stat.levels'), value: String(stats.levels) },
    { label: t('dashboard.stat.nodes'), value: String(stats.nodes) },
    { label: t('dashboard.stat.edges'), value: String(stats.edges) },
    { label: t('dashboard.stat.destinations'), value: String(stats.destinations) },
    { label: t('dashboard.stat.supporttypes'), value: String(stats.supportTypes) },
    { label: t('dashboard.stat.templates'), value: String(stats.templates) },
    { label: t('dashboard.stat.findings'), value: String(stats.findings), warn: stats.findings > 0 },
  ];

  return (
    <div>
      <h1 style={{
        margin: '0 0 4px',
        fontSize: 22,
        fontWeight: 500,
        color: 'var(--text-primary)',
      }}>
        {t('dashboard.title')}
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 24 }}>
        {site.site.name} — {site.organization.name}
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 16,
      }}>
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>
    </div>
  );
}

type StatCardProps = {
  readonly label: string;
  readonly value: string;
  readonly warn?: boolean;
};

function StatCard({ label, value, warn }: StatCardProps): JSX.Element {
  // Flat, calm (F1.2 principe 2 / F1.3): no shadow, no hover elevation.
  return (
    <div
      style={{
        padding: 20,
        borderRadius: 6,
        border: `1px solid ${warn ? 'var(--state-blocking)' : 'var(--border-hairline)'}`,
        background: warn ? 'var(--accent-soft)' : 'var(--surface-panel)',
        cursor: 'default',
      }}
    >
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
          {label}
        </span>
      </div>
      <div style={{
        fontSize: 22,
        fontWeight: 500,
        color: warn ? 'var(--state-blocking)' : 'var(--text-primary)',
      }}>
        {value}
      </div>
    </div>
  );
}
