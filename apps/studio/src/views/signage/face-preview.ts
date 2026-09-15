/**
 * Aperçu d'une face — résolution et rendu.
 *
 * Une seule implémentation, partagée par l'écran Signalétique et l'écran
 * Faces : la face est résolue par le moteur puis rendue par le moteur, jamais
 * redessinée par un écran (invariant 2).
 */
import { composeFace, renderFace } from '@azimut/engine-graph';
import type { FaceTheme, ResolvedFace } from '@azimut/engine-graph';
import type { FaceTemplate, SiteData, TravelProfile, GraphNode } from '@azimut/core-model';

/**
 * Support et horodatage de l'aperçu : deux valeurs fixes, pour que deux
 * aperçus du même état de données soient identiques (invariant 4).
 */
export const PREVIEW_SUPPORT_ID = 'preview';
export const PREVIEW_GENERATED_AT = '1970-01-01T00:00:00.000Z';

export const FACE_THEME: FaceTheme = {
  background: 'var(--surface-panel)',
  text_primary: 'var(--text-primary)',
  text_secondary: 'var(--text-secondary)',
  accent: 'var(--surface-sunken)',
  border: 'var(--border-hairline)',
};

export const PREVIEW_FONT_FAMILY = 'system-ui, sans-serif';

export type RenderedPreview = {
  readonly svg: string;
  readonly node: GraphNode;
  readonly face: ResolvedFace;
  readonly width_mm: number;
  readonly height_mm: number;
};

/** Nœud d'aperçu : un carrefour de préférence, sinon une entrée, sinon le premier. */
export function findPreviewNode(nodes: readonly GraphNode[]): GraphNode | undefined {
  return nodes.find(n => n.kind === 'junction')
    ?? nodes.find(n => n.kind === 'entrance')
    ?? nodes[0];
}

/** Dimensions déclarées par la typologie pour le côté du gabarit. */
export function faceDimensions(
  site: SiteData,
  template: FaceTemplate,
): { readonly width_mm: number; readonly height_mm: number } | null {
  const type = site.support_types.find(s => s.key === template.support_type_key);
  const face = type?.faces.find(f => f.side === template.side);
  if (face === undefined) return null;
  return { width_mm: face.default_width_mm, height_mm: face.default_height_mm };
}

export function renderPreview(
  site: SiteData,
  template: FaceTemplate,
  profile: TravelProfile,
  lang: string,
): RenderedPreview | null {
  const node = findPreviewNode(site.graph.nodes);
  if (node === undefined) return null;

  const dimensions = faceDimensions(site, template);
  if (dimensions === null) return null;

  const resolved = composeFace({
    site,
    template,
    profile,
    supportId: PREVIEW_SUPPORT_ID,
    nodeId: node.id,
    generated_at: PREVIEW_GENERATED_AT,
  });
  if (!resolved.ok) return null;

  const svg = renderFace(resolved.value, {
    width_mm: dimensions.width_mm,
    height_mm: dimensions.height_mm,
    theme: FACE_THEME,
    font_family: PREVIEW_FONT_FAMILY,
    lang,
  });

  return {
    svg,
    node,
    face: resolved.value,
    width_mm: dimensions.width_mm,
    height_mm: dimensions.height_mm,
  };
}
