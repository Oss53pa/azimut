import { type JSX, useMemo } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import { runChecks, validateGraph, validateGeometry } from '@azimut/engine-graph';

function outcomeFindings(result: { ok: boolean; warnings?: unknown[]; findings?: unknown[] }): number {
  if (result.ok && 'warnings' in result) return (result.warnings as unknown[]).length;
  if (!result.ok && 'findings' in result) return (result.findings as unknown[]).length;
  return 0;
}

export function DashboardView(): JSX.Element {
  const site = useSiteData();

  const stats = useMemo(() => {
    const checkResult = runChecks(site);
    const graphResult = validateGraph(site);
    const geomResult = validateGeometry(site);
    const checkFindings = checkResult.ok ? checkResult.value.findings.length : 0;
    const graphFindings = outcomeFindings(graphResult);
    const geomFindings = outcomeFindings(geomResult);

    return {
      levels: site.levels.length,
      nodes: site.graph.nodes.length,
      edges: site.graph.edges.length,
      destinations: site.destinations.length,
      supportTypes: site.support_types.length,
      templates: site.face_templates.length,
      findings: checkFindings + graphFindings + geomFindings,
    };
  }, [site]);

  return (
    <div>
      <h1 style={{ margin: '0 0 8px', fontSize: 22, color: 'var(--az-text-primary)' }}>
        Tableau de bord
      </h1>
      <p style={{ color: 'var(--az-text-secondary)', fontSize: 13, marginBottom: 16 }}>
        {site.site.name} — {site.organization.name}
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 12,
      }}>
        <StatCard label="Niveaux" value={String(stats.levels)} />
        <StatCard label="Noeuds" value={String(stats.nodes)} />
        <StatCard label="Aretes" value={String(stats.edges)} />
        <StatCard label="Destinations" value={String(stats.destinations)} />
        <StatCard label="Types support" value={String(stats.supportTypes)} />
        <StatCard label="Gabarits" value={String(stats.templates)} />
        <StatCard
          label="Alertes"
          value={String(stats.findings)}
          warn={stats.findings > 0}
        />
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
  return (
    <div style={{
      padding: 16,
      borderRadius: 8,
      border: '1px solid var(--az-border)',
      background: 'var(--az-card-bg)',
    }}>
      <div style={{ fontSize: 12, color: 'var(--az-text-secondary)', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{
        fontSize: 24,
        fontWeight: 700,
        color: warn ? 'var(--az-active-text)' : 'var(--az-text-primary)',
      }}>
        {value}
      </div>
    </div>
  );
}
