import type { SiteData } from '@azimut/core-model';
import { resolveFaceContent, renderFace } from '@azimut/engine-graph';
import type { FaceTheme } from '@azimut/engine-graph';
import { exportArtworkPdf } from '@azimut/engine-artwork';
import type { PdfTarget } from '@azimut/engine-artwork';

/**
 * Shared artwork rendering for the compiler handlers.
 *
 * Resolves a face's content from the graph and directory, renders it to SVG,
 * and exports the print PDF. Both `compile_artworks` (single face) and
 * `build_delivery_archive` (a batch) go through here, so a face is rendered
 * exactly one way.
 */
export type ArtworkRenderParams = {
  readonly site: SiteData;
  readonly theme: FaceTheme;
  readonly fontFamily: string;
  readonly pdfTarget: PdfTarget;
  readonly creationDate: Date;
  readonly nodeId: string;
  readonly templateId: string;
  readonly profileKey: string;
  readonly title: string;
};

export type ArtworkRender = {
  readonly svg: string;
  readonly pdf: Uint8Array;
  readonly side: string;
  readonly widthMm: number;
  readonly heightMm: number;
};

export async function renderArtwork(
  params: ArtworkRenderParams,
): Promise<ArtworkRender> {
  const { site } = params;

  const template = site.face_templates.find((t) => t.id === params.templateId);
  if (!template) {
    throw new Error(`Template not found: ${params.templateId}`);
  }

  const profile = site.travel_profiles.find((p) => p.key === params.profileKey);
  if (!profile) {
    throw new Error(`Profile not found: ${params.profileKey}`);
  }

  const supportType = site.support_types.find(
    (st) => st.key === template.support_type_key,
  );
  const face = supportType?.faces.find((f) => f.side === template.side);
  const widthMm = face?.default_width_mm ?? 600;
  const heightMm = face?.default_height_mm ?? 400;

  const resolved = resolveFaceContent(site, template, params.nodeId, profile);
  if (!resolved.ok) {
    const codes = resolved.findings.map((f) => f.code).join(', ');
    throw new Error(`Resolve failed: ${codes}`);
  }

  const svg = renderFace(resolved.value, {
    width_mm: widthMm,
    height_mm: heightMm,
    theme: params.theme,
    font_family: params.fontFamily,
  });

  const pdf = await exportArtworkPdf({
    svg,
    target: params.pdfTarget,
    title: params.title,
    width_mm: widthMm,
    height_mm: heightMm,
    creation_date: params.creationDate,
  });

  return { svg, pdf, side: template.side, widthMm, heightMm };
}
