import { type JSX, useMemo, useState } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import { resolveFaceContent, renderFace } from '@azimut/engine-graph';
import type { FaceTheme } from '@azimut/engine-graph';
import type { FaceTemplate, TravelProfile, GraphNode } from '@azimut/core-model';

const FACE_THEME: FaceTheme = {
  background: 'var(--surface-panel)',
  text_primary: 'var(--text-primary)',
  text_secondary: 'var(--text-secondary)',
  accent: 'var(--surface-sunken)',
  border: 'var(--border-hairline)',
};

function findPreviewNode(
  nodes: readonly GraphNode[],
): GraphNode | undefined {
  return (
    nodes.find((n) => n.kind === 'junction')
    ?? nodes.find((n) => n.kind === 'entrance')
    ?? nodes[0]
  );
}

type RenderedPreview = {
  readonly svg: string;
  readonly node: GraphNode;
};

function renderPreview(
  site: Parameters<typeof resolveFaceContent>[0],
  template: FaceTemplate,
  nodes: readonly GraphNode[],
  profile: TravelProfile,
  typeWidth: number,
  typeHeight: number,
): RenderedPreview | null {
  const node = findPreviewNode(nodes);
  if (!node) return null;

  const resolved = resolveFaceContent(site, template, node.id, profile);
  if (!resolved.ok) return null;

  const svg = renderFace(resolved.value, {
    width_mm: typeWidth,
    height_mm: typeHeight,
    theme: FACE_THEME,
    font_family: 'system-ui, sans-serif',
  });
  return { svg, node };
}

export function FacesView(): JSX.Element {
  const site = useSiteData();

  const templates = useMemo(
    () => [...site.face_templates].sort((a, b) => a.id.localeCompare(b.id)),
    [site],
  );

  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? '');
  const selected = templates.find((t) => t.id === selectedId);

  const profile = site.travel_profiles[0] ?? null;

  const preview = useMemo(() => {
    if (!selected || !profile) return null;
    const st = site.support_types.find(
      (s) => s.key === selected.support_type_key,
    );
    const face = st?.faces.find((f) => f.side === selected.side);
    const width = face?.default_width_mm ?? 600;
    const height = face?.default_height_mm ?? 400;
    return renderPreview(
      site, selected, site.graph.nodes, profile, width, height,
    );
  }, [site, selected, profile]);

  if (templates.length === 0) {
    return (
      <div>
        <h1 style={{ margin: '0 0 16px', fontSize: 22, color: 'var(--text-primary)' }}>
          Rendus de faces
        </h1>
        <div style={{
          marginTop: 16,
          padding: 32,
          borderRadius: 4,
          border: '2px dashed var(--border-hairline)',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          fontSize: 14,
        }}>
          Aucun gabarit de face configure.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ margin: '0 0 8px', fontSize: 22, color: 'var(--text-primary)' }}>
        Rendus de faces
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
        Apercu SVG des faces resolues pour chaque gabarit.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedId(t.id)}
            style={{
              padding: '6px 14px',
              border: '1px solid var(--border-hairline)',
              borderRadius: 6,
              background: selectedId === t.id ? 'var(--surface-sunken)' : 'var(--surface-panel)',
              color: selectedId === t.id ? 'var(--accent)' : 'var(--text-primary)',
              fontWeight: selectedId === t.id ? 500 : 400,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {t.name}
          </button>
        ))}
      </div>

      {selected && (
        <div style={{
          marginBottom: 16,
          fontSize: 12,
          color: 'var(--text-secondary)',
        }}>
          Type : {selected.support_type_key} / Face : {selected.side} / {selected.blocks.length} bloc{selected.blocks.length !== 1 ? 's' : ''}
        </div>
      )}

      {preview ? (
        <div style={{
          borderRadius: 4,
          border: '1px solid var(--border-hairline)',
          overflow: 'hidden',
          background: 'var(--surface-panel)',
        }}>
          <div style={{
            padding: '8px 12px',
            borderBottom: '1px solid var(--border-hairline)',
            fontSize: 12,
            color: 'var(--text-secondary)',
          }}>
            Noeud : {preview.node.label} ({preview.node.kind})
          </div>
          <div
            style={{ padding: 16 }}
            dangerouslySetInnerHTML={{ __html: preview.svg }}
          />
        </div>
      ) : (
        <div style={{
          padding: 32,
          borderRadius: 4,
          border: '2px dashed var(--border-hairline)',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          fontSize: 14,
        }}>
          {!profile
            ? 'Aucun profil de parcours disponible.'
            : 'Apercu indisponible pour ce gabarit.'}
        </div>
      )}
    </div>
  );
}
