import { type JSX, useMemo, useState } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import { runChecks, validateGraph, validateGeometry, validateDirectory } from '@azimut/engine-graph';

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

  const cards: readonly { label: string; value: string; icon: string; warn?: boolean }[] = [
    { label: 'Niveaux', value: String(stats.levels), icon: '🏢' },
    { label: 'Nœuds', value: String(stats.nodes), icon: '⬡' },
    { label: 'Arêtes', value: String(stats.edges), icon: '↔️' },
    { label: 'Destinations', value: String(stats.destinations), icon: '📍' },
    { label: 'Types support', value: String(stats.supportTypes), icon: '🪧' },
    { label: 'Gabarits', value: String(stats.templates), icon: '📐' },
    { label: 'Alertes', value: String(stats.findings), icon: '⚠️', warn: stats.findings > 0 },
  ];

  return (
    <div>
      <h1 style={{
        margin: '0 0 4px',
        fontSize: 24,
        fontWeight: 500,
        color: 'var(--text-primary)',
      }}>
        Tableau de bord
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, marginBottom: 24 }}>
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
  readonly icon: string;
  readonly warn?: boolean;
};

function StatCard({ label, value, icon, warn }: StatCardProps): JSX.Element {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: 20,
        borderRadius: 12,
        border: `1px solid ${warn ? 'var(--state-blocking)' : 'var(--border-hairline)'}`,
        background: warn ? 'var(--accent-soft)' : 'var(--surface-panel)',
        boxShadow: hovered ? 'var(--shadow-dialog)' : 'var(--shadow-float)',
        transition: 'box-shadow 0.2s, transform 0.2s',
        transform: hovered ? 'translateY(-2px)' : 'none',
        cursor: 'default',
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
      }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
          {label}
        </span>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <div style={{
        fontSize: 28,
        fontWeight: 700,
        color: warn ? 'var(--state-blocking)' : 'var(--text-primary)',
      }}>
        {value}
      </div>
    </div>
  );
}
