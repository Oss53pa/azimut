import type { SiteData, Finding } from '@azimut/core-model';
import { composeFace, renderFaceWithMeasures, checkFaceContrast } from '@azimut/engine-graph';
import type { FaceTheme, LoadedRulesPack } from '@azimut/engine-graph';
import { exportArtworkPdf } from '@azimut/engine-artwork';
import type { PdfTarget } from '@azimut/engine-artwork';

/**
 * Shared artwork rendering for the compiler handlers.
 *
 * The face content comes from the message schedule (H2.5), never straight
 * from the graph: `composeFace` reads message lines and the template supplies
 * the layout. Both `compile_artworks` (single face) and
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
  /** Support composed on that node — identifies its lines in the schedule. */
  readonly supportId: string;
  readonly templateId: string;
  readonly profileKey: string;
  readonly title: string;
  /**
   * When a rules pack is bound to the site, the face's theme contrast is
   * checked against it (G6.2). The binding itself is in the data model
   * (A5.8: `site_rules_binding`, folded onto `Site.rules_pack_id`), but no
   * resolver yet maps that id to a `LoadedRulesPack`; until one exists the
   * caller supplies the pack directly. Dormant when none is supplied.
   */
  readonly rulesPack?: LoadedRulesPack;
  /** Orientation registry of the support; defaults to 'wayfinding'. */
  readonly supportRegistry?: string;
};

export type ArtworkRender = {
  readonly svg: string;
  readonly pdf: Uint8Array;
  readonly side: string;
  readonly supportTypeKey: string;
  readonly widthMm: number;
  readonly heightMm: number;
  /** Contrast anomalies from the rules check; empty when no pack is bound. */
  readonly contrastFindings: readonly Finding[];
  /**
   * Smallest denomination-text font size rendered (em, mm), or null when the
   * face has no such text. The measured input a legibility check would read
   * against the pack's LEGIBILITY.MIN_CHAR_HEIGHT; not yet enforced.
   */
  readonly minTextFontSizeMm: number | null;
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

  const resolved = composeFace({
    site,
    template,
    profile,
    supportId: params.supportId,
    nodeId: params.nodeId,
    // Fourni par l'appelant, jamais lu ici (H2.5, E5.1).
    generated_at: params.creationDate.toISOString(),
  });
  if (!resolved.ok) {
    const codes = resolved.findings.map((f) => f.code).join(', ');
    throw new Error(`Compose failed: ${codes}`);
  }

  const { svg, min_text_font_size_mm } = renderFaceWithMeasures(resolved.value, {
    width_mm: widthMm,
    height_mm: heightMm,
    theme: params.theme,
    font_family: params.fontFamily,
  });

  let contrastFindings: readonly Finding[] = [];
  if (params.rulesPack !== undefined) {
    const contrast = checkFaceContrast(params.rulesPack, {
      face_id: params.supportId,
      supportRegistry: params.supportRegistry ?? 'wayfinding',
      theme: params.theme,
    });
    if (!contrast.ok) contrastFindings = contrast.findings;
  }

  const pdf = await exportArtworkPdf({
    svg,
    target: params.pdfTarget,
    title: params.title,
    width_mm: widthMm,
    height_mm: heightMm,
    creation_date: params.creationDate,
  });

  return {
    svg,
    pdf,
    side: template.side,
    supportTypeKey: template.support_type_key,
    widthMm,
    heightMm,
    contrastFindings,
    minTextFontSizeMm: min_text_font_size_mm,
  };
}
