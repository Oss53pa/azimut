import { type JSX, useMemo } from 'react';
import { useSiteData } from '../context/useSiteData.js';

export function GraphView(): JSX.Element {
  const site = useSiteData();

  const summary = useMemo(() => {
    const kindCounts = new Map<string, number>();
    for (const n of site.graph.nodes) {
      kindCounts.set(n.kind, (kindCounts.get(n.kind) ?? 0) + 1);
    }

    const levelNodes = new Map<string, number>();
    for (const n of site.graph.nodes) {
      levelNodes.set(n.level_id, (levelNodes.get(n.level_id) ?? 0) + 1);
    }

    const levelNames = new Map<string, string>();
    for (const l of site.levels) {
      levelNames.set(l.id, l.name);
    }

    const evacCount = site.graph.edges.filter((e) => e.evacuation_route).length;
    const accessibleEdges = site.graph.edges.filter((e) => e.accessible).length;

    return {
      nodesByKind: [...kindCounts.entries()].sort(([a], [b]) => a.localeCompare(b)),
      nodesByLevel: [...levelNodes.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, count]) => ({ name: levelNames.get(id) ?? id, count })),
      totalEdges: site.graph.edges.length,
      evacCount,
      accessibleEdges,
      verticalLinks: site.graph.vertical_links.length,
    };
  }, [site]);

  return (
    <div>
      <h1 style={{ margin: '0 0 8px', fontSize: 22, color: 'var(--az-text-primary)' }}>
        Graphe de circulation
      </h1>
      <p style={{ color: 'var(--az-text-secondary)', fontSize: 13, marginBottom: 16 }}>
        {site.graph.nodes.length} noeuds, {summary.totalEdges} aretes,
        {' '}{summary.verticalLinks} liens verticaux
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Section title="Noeuds par type">
          {summary.nodesByKind.map(([kind, count]) => (
            <Row key={kind} label={kind} value={String(count)} />
          ))}
        </Section>

        <Section title="Noeuds par niveau">
          {summary.nodesByLevel.map((l) => (
            <Row key={l.name} label={l.name} value={String(l.count)} />
          ))}
        </Section>

        <Section title="Aretes">
          <Row label="Total" value={String(summary.totalEdges)} />
          <Row label="Accessibles" value={String(summary.accessibleEdges)} />
          <Row label="Evacuation" value={String(summary.evacCount)} />
        </Section>

        <Section title="Liens verticaux">
          {site.graph.vertical_links.map((vl) => (
            <Row key={vl.id} label={vl.kind} value={`capacite ${vl.capacity}`} />
          ))}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: {
  readonly title: string;
  readonly children: JSX.Element | JSX.Element[];
}): JSX.Element {
  return (
    <div style={{
      padding: 16,
      borderRadius: 8,
      border: '1px solid var(--az-border)',
      background: 'var(--az-card-bg)',
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--az-text-secondary)',
        marginBottom: 8,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { readonly label: string; readonly value: string }): JSX.Element {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '4px 0',
      fontSize: 13,
      color: 'var(--az-text-primary)',
    }}>
      <span>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
