import type { SiteData, Finding } from '@azimut/core-model';
import {
  composeFace, renderFaceWithMeasures, checkFaceContrast, checkCharHeight, faceUsesAccent,
  checkFaceContentFit, computeFaceFormat, requiredCharHeightMm,
} from '@azimut/engine-graph';
import type {
  FaceTheme, LoadedRulesPack, TextMeasure, FaceFormat, ResolvedFace,
} from '@azimut/engine-graph';
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
  /**
   * A5.6 — dimensions carried by the support instance (mm). When set they
   * override the typology's default face size.
   */
  readonly overrideWidthMm?: number;
  readonly overrideHeightMm?: number;
  /**
   * A5.6 — origin of the dimensions. When 'overridden' and the resulting format
   * is non-conform, LAYOUT.DIMENSIONS_OVERRIDDEN_NONCONFORM is raised.
   */
  readonly dimensionsSource?: string;
  /**
   * Deterministic text measurement (G5.1). When supplied, the content-fit check
   * (LAYOUT.CONTENT_OVERFLOW) runs; dormant otherwise, since no metrics table
   * ships yet.
   */
  readonly measureText?: TextMeasure;
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
  /**
   * A5.6 — raised (LAYOUT.DIMENSIONS_OVERRIDDEN_NONCONFORM) when the support's
   * dimensions were hand-set ('overridden') and the resulting format fails the
   * format-conformance (legibility) check. Empty otherwise.
   */
  readonly dimensionsFindings: readonly Finding[];
  /**
   * Content-fit anomalies (LAYOUT.CONTENT_OVERFLOW). Empty unless a text measure
   * is supplied; a piece of text wider than its block raises one.
   */
  readonly contentOverflowFindings: readonly Finding[];
  /**
   * M04.G3 — le format que le contenu, la distance de lecture et la variante
   * linguistique la plus longue imposent, indépendamment de celui qui a été
   * employé. `null` quand il n'est pas calculable : pas de paquet rattaché, pas
   * de distance relevée, ou pas de liste de destinations sur la face. Sa
   * largeur reste `null` tant qu'aucune mesure de texte n'est fournie.
   */
  readonly computedFormat: FaceFormat | null;
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
  // A5.6 — the support instance's dimensions win when set (dimensions_source
  // 'overridden'); otherwise the typology's default face size, then a fallback.
  const widthMm = params.overrideWidthMm ?? face?.default_width_mm ?? 600;
  const heightMm = params.overrideHeightMm ?? face?.default_height_mm ?? 400;

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

  const renderOptions = {
    width_mm: widthMm,
    height_mm: heightMm,
    theme: params.theme,
    font_family: params.fontFamily,
  };
  const { svg, min_text_font_size_mm } = renderFaceWithMeasures(resolved.value, renderOptions);

  // Content fit (LAYOUT.CONTENT_OVERFLOW). Runs only when a text measure is
  // supplied — no font-metrics table ships yet (G5.1), so it is dormant.
  let contentOverflowFindings: readonly Finding[] = [];
  if (params.measureText !== undefined) {
    contentOverflowFindings = checkFaceContentFit(
      resolved.value, renderOptions, params.measureText,
    );
  }

  let contrastFindings: readonly Finding[] = [];
  if (params.rulesPack !== undefined) {
    const contrast = checkFaceContrast(params.rulesPack, {
      face_id: params.supportId,
      supportRegistry: params.supportRegistry ?? 'wayfinding',
      ...(params.supportContext !== undefined ? { context: params.supportContext } : {}),
      theme: params.theme,
      hasAccentContent: faceUsesAccent(resolved.value),
    });
    if (!contrast.ok) contrastFindings = contrast.findings;
  }

  // Legibility (LEGIBILITY.MIN_CHAR_HEIGHT). Scoped by the support's reading
  // context (D3.5); needs a bound pack, a context, a positive reading distance,
  // and a measured text height. A support with no surveyed distance (0) is not
  // checked — the floor would flag it on data it does not have. The height is
  // the rendered em size — cap-height conversion (partie G) is deferred, so the
  // verdict is provisional.
  let legibilityFindings: readonly Finding[] = [];
  if (
    params.rulesPack !== undefined
    && params.supportContext !== undefined
    && params.readingDistanceM !== undefined
    && params.readingDistanceM > 0
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

  // M04.G3 — le format que le contenu, la distance de lecture et la variante
  // linguistique la plus longue imposent. Calculé quand un paquet est rattaché
  // et qu'une distance est relevée ; la largeur reste indéterminée tant
  // qu'aucune mesure de texte n'est fournie (G5.1).
  const computedFormat = requiredFaceFormat(params, resolved.value);

  // A5.6 / M04.G3 — a hand-set format that comes out non-conform is a blocking
  // anomaly distinct from the underlying failure: it tells the operator to fix
  // the dimensions, not the content. Triggered by any format check — the text
  // too small for the reading distance (legibility) or text wider than its
  // block (content overflow).
  //
  // Le format calculé accompagne l'anomalie quand il est connu : dire « non
  // conforme » sans dire quelle taille conviendrait laisse l'opérateur tâtonner.
  let dimensionsFindings: readonly Finding[] = [];
  const formatNonConform = legibilityFindings.length > 0 || contentOverflowFindings.length > 0;
  if (params.dimensionsSource === 'overridden' && formatNonConform) {
    dimensionsFindings = [{
      code: 'LAYOUT.DIMENSIONS_OVERRIDDEN_NONCONFORM',
      severity: 'blocking',
      entity: { kind: 'support', id: params.supportId },
      params: {
        width_mm: widthMm,
        height_mm: heightMm,
        ...(computedFormat !== null
          ? { required_height_mm: computedFormat.height_mm }
          : {}),
        ...(computedFormat?.width_mm != null
          ? { required_width_mm: computedFormat.width_mm }
          : {}),
      },
      ruleRef: 'N4.3',
    }];
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
    computedFormat,
    side: template.side,
    supportTypeKey: template.support_type_key,
    widthMm,
    heightMm,
    contrastFindings,
    minTextFontSizeMm: min_text_font_size_mm,
    legibilityFindings,
    dimensionsFindings,
    contentOverflowFindings,
  };
}

/**
 * M04.G3 — le format que le contenu, la distance de lecture et la variante
 * linguistique la plus longue imposent.
 *
 * Rend `null` dès qu'une des trois entrées manque : sans paquet rattaché, la
 * hauteur de caractère exigée est inconnue et aucune valeur normative ne doit
 * lui être substituée (M04.G4) ; sans distance relevée, la règle n'a rien à quoi
 * s'appliquer ; sans liste de destinations, la face n'a pas de lignes à
 * dimensionner.
 */
export type RequiredFormatInput = {
  readonly rulesPack?: LoadedRulesPack | undefined;
  readonly readingDistanceM?: number | undefined;
  readonly supportRegistry?: string | undefined;
  readonly supportContext?: string | undefined;
  readonly supportId: string;
  readonly measureText?: TextMeasure | undefined;
};

export function requiredFaceFormat(
  params: RequiredFormatInput,
  face: ResolvedFace,
): FaceFormat | null {
  if (params.rulesPack === undefined) return null;
  if (params.readingDistanceM === undefined || params.readingDistanceM <= 0) return null;

  const block = face.blocks.find(b => b.content.type === 'destination_list');
  if (block === undefined || block.content.type !== 'destination_list') return null;
  const entries = block.content.entries;
  if (entries.length === 0) return null;

  const required = requiredCharHeightMm(params.rulesPack, {
    supportRegistry: params.supportRegistry ?? 'wayfinding',
    ...(params.supportContext !== undefined ? { context: params.supportContext } : {}),
    reading_distance_m: params.readingDistanceM,
    char_height_mm: 0,
    entity_id: params.supportId,
  });
  if (!required.ok) return null;

  // La variante la plus longue parmi les dénominations de la face : une face
  // dimensionnée sur le français déborderait en anglais, et l'inverse.
  const longest = entries
    .flatMap(entry => Object.values(entry.names))
    .filter((name): name is string => typeof name === 'string')
    .reduce((longestSoFar, name) => (
      name.length > longestSoFar.length ? name : longestSoFar
    ), '');

  const format = computeFaceFormat({
    entry_count: entries.length,
    required_char_height_mm: required.value,
    block_height_pct: block.region.h_pct,
    block_width_pct: block.region.w_pct,
    ...(longest.length > 0 ? { longest_variant: longest } : {}),
    ...(params.measureText !== undefined ? { measure: params.measureText } : {}),
  });
  return format.ok ? format.value : null;
}
