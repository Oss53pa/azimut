import { type JSX, useMemo } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import { resolveFaceContent } from '@azimut/engine-graph';
import type { FaceTemplate, TravelProfile, GraphNode } from '@azimut/core-model';

type FaceStatus = {
  readonly template: FaceTemplate;
  readonly node: GraphNode | null;
  readonly resolved: boolean;
  readonly warningCount: number;
};

function evaluateFaces(
  site: Parameters<typeof resolveFaceContent>[0],
  templates: readonly FaceTemplate[],
  profile: TravelProfile | null,
  nodes: readonly GraphNode[],
): readonly FaceStatus[] {
  if (!profile) return templates.map((t) => ({
    template: t, node: null, resolved: false, warningCount: 0,
  }));

  return templates.map((template) => {
    const node = nodes.find((n) => n.kind === 'junction')
      ?? nodes.find((n) => n.kind === 'entrance')
      ?? nodes[0]
      ?? null;
    if (!node) {
      return { template, node: null, resolved: false, warningCount: 0 };
    }
    const result = resolveFaceContent(site, template, node.id, profile);
    return {
      template,
      node,
      resolved: result.ok,
      warningCount: result.ok ? result.warnings.length : 0,
    };
  });
}

export function ProofsView(): JSX.Element {
  const site = useSiteData();
  const profile = site.travel_profiles[0] ?? null;

  const statuses = useMemo(
    () => evaluateFaces(
      site,
      [...site.face_templates].sort((a, b) => a.id.localeCompare(b.id)),
      profile,
      site.graph.nodes,
    ),
    [site, profile],
  );

  const resolvedCount = statuses.filter((s) => s.resolved).length;
  const totalWarnings = statuses.reduce((sum, s) => sum + s.warningCount, 0);

  return (
    <div>
      <h1 style={{ margin: '0 0 8px', fontSize: 22, color: 'var(--az-text-primary)' }}>
        Bons a tirer
      </h1>
      <p style={{ color: 'var(--az-text-secondary)', fontSize: 13, marginBottom: 16 }}>
        {statuses.length} gabarit{statuses.length !== 1 ? 's' : ''} /{' '}
        {resolvedCount} resolu{resolvedCount !== 1 ? 's' : ''} /{' '}
        {totalWarnings} avertissement{totalWarnings !== 1 ? 's' : ''}
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--az-border)' }}>
              <Th>Gabarit</Th>
              <Th>Type / Face</Th>
              <Th>Noeud test</Th>
              <Th>Statut</Th>
              <Th>Avertissements</Th>
            </tr>
          </thead>
          <tbody>
            {statuses.length === 0 ? (
              <tr>
                <td colSpan={5} style={{
                  padding: 24,
                  textAlign: 'center',
                  color: 'var(--az-text-secondary)',
                }}>
                  Aucun gabarit configure.
                </td>
              </tr>
            ) : statuses.map((s) => (
              <tr key={s.template.id} style={{ borderBottom: '1px solid var(--az-border)' }}>
                <td style={{ padding: '8px 12px', color: 'var(--az-text-primary)', fontWeight: 500 }}>
                  {s.template.name}
                </td>
                <td style={{ padding: '8px 12px', color: 'var(--az-text-secondary)', fontSize: 12 }}>
                  {s.template.support_type_key} / {s.template.side}
                </td>
                <td style={{ padding: '8px 12px', color: 'var(--az-text-secondary)', fontSize: 12 }}>
                  {s.node?.label ?? '—'}
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    background: s.resolved ? 'var(--az-active-bg)' : 'var(--az-border)',
                    color: s.resolved ? 'var(--az-active-text)' : 'var(--az-text-secondary)',
                  }}>
                    {s.resolved ? 'Resolu' : 'Echec'}
                  </span>
                </td>
                <td style={{ padding: '8px 12px', color: 'var(--az-text-secondary)', fontSize: 12, textAlign: 'center' }}>
                  {s.warningCount > 0 ? s.warningCount : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { readonly children: string }): JSX.Element {
  return (
    <th style={{
      textAlign: 'left',
      padding: '8px 12px',
      fontWeight: 600,
      color: 'var(--az-text-secondary)',
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }}>
      {children}
    </th>
  );
}
