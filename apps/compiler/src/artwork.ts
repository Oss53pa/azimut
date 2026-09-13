import type { SiteData, Finding } from '@azimut/core-model';
import {
  composeFace, renderFaceWithMeasures, checkFaceContrast, checkCharHeight,
} from '@azimut/engine-graph';
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
  /**
   * Reading context of the support (interior/exterior) — scopes the legibility
   * rule (D3.5). Legibility is checked only when this, `readingDistanceM`, a
   * bound pack, and a measured text size are all present.
   */
  readonly supportContext?: string;
  /** Reading distance of the support (m) — feeds the legibility formula. */
  readonly readingDistanceM?: number;
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
   * face has no such text. The measured input the legibility check reads
   * against the pack's LEGIBILITY.MIN_CHAR_HEIGHT.
   */
  readonly minTextFontSizeMm: number | null;
  /**
   * Legibility anomalies (LAYOUT.CHAR_HEIGHT_BELOW_MIN). Empty unless a pack is
   * bound and the support carries a reading context and distance. The height
   * fed in is the em size (partie-G cap-height metrics not yet applied) and the
   * fixture factor is provisional (D18), so the numeric verdict is provisional;
   * the scoping and integration are complete.
   */
  readonly legibilityFindings: readonly Finding[];
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

  // Legibility (LEGIBILITY.MIN_CHAR_HEIGHT). Scoped by the support's reading
  // context (D3.5); needs a bound pack, a context, a reading distance, and a
  // measured text height. The height is the rendered em size — cap-height
  // conversion (partie G) is deferred, so the verdict is provisional.
  let legibilityFindings: readonly Finding[] = [];
  if (
    params.rulesPack !== undefined
    && params.supportContext !== undefined
    && params.readingDistanceM !== undefined
    && min_text_font_size_mm !== null
  ) {
    const legibility = checkCharHeight(params.rulesPack, {
      supportRegistry: params.supportRegistry ?? 'wayfinding',
      context: params.supportContext,
      reading_distance_m: params.readingDistanceM,
      char_height_mm: min_text_font_size_mm,
      entity_id: params.supportId,
    });
    if (!legibility.ok) legibilityFindings = legibility.findings;
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
    legibilityFindings,
  };
}
