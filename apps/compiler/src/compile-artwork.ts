import type { SiteData } from '@azimut/core-model';
import type { FaceTheme, LoadedRulesPack, RulesPackIndex } from '@azimut/engine-graph';
import type { PdfTarget } from '@azimut/engine-artwork';
import { renderArtwork } from './artwork.js';
import { resolveEffectivePack, supportRenderParams } from './rules-binding.js';
import type { Job } from './job.js';

export type CompileArtworkResult = {
  readonly support_id: string;
  readonly face_side: string;
  readonly svg: string;
  readonly pdf: Uint8Array;
};

export type CompileContext = {
  readonly site: SiteData;
  readonly theme: FaceTheme;
  readonly font_family: string;
  readonly pdf_target: PdfTarget;
  readonly creation_date: Date;
  /**
   * Optional explicit rules pack. When supplied it takes precedence and the
   * face theme's contrast is checked against it.
   */
  readonly rules_pack?: LoadedRulesPack;
  /**
   * Optional pack corpus. When no explicit `rules_pack` is given, the pack the
   * site is bound to (A5.8 `site_rules_binding` / `Site.rules_pack_id`) is
   * resolved from this index. A site with no binding — or a binding absent from
   * the corpus — surfaces `RULES.PACK_NOT_BOUND` and skips the check; it does
   * not abort artwork production. The index's source (database vs file corpus)
   * is the composition root's choice, not fixed here.
   */
  readonly rules_pack_index?: RulesPackIndex;
};

export function createArtworkHandler(
  context: CompileContext,
): (job: Job) => Promise<Record<string, unknown>> {
  const {
    site, theme, font_family, pdf_target, creation_date,
    rules_pack, rules_pack_index,
  } = context;

  const { pack: effectivePack, findings: packFindings } = resolveEffectivePack(
    site, rules_pack, rules_pack_index,
  );

  return async (job: Job): Promise<Record<string, unknown>> => {
    const payload = job.payload;
    const nodeId = typeof payload['node_id'] === 'string'
      ? payload['node_id']
      : '';
    const templateId = typeof payload['template_id'] === 'string'
      ? payload['template_id']
      : '';
    const profileKey = typeof payload['profile_key'] === 'string'
      ? payload['profile_key']
      : 'standard';
    const supportId = typeof payload['support_id'] === 'string'
      ? payload['support_id']
      : job.id;

    const template = site.face_templates.find((t) => t.id === templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // A5.6 — the support instance carries the registry and reading context that
    // scope the rules; unknown supports fall back to the render's own defaults.
    const support = site.supports.find((s) => s.id === supportId);

    const {
      svg, pdf, side, contrastFindings, minTextFontSizeMm, legibilityFindings,
    } = await renderArtwork({
      site,
      theme,
      fontFamily: font_family,
      pdfTarget: pdf_target,
      creationDate: creation_date,
      nodeId,
      supportId,
      templateId,
      profileKey,
      title: `${supportId} — ${template.side}`,
      ...(effectivePack !== undefined ? { rulesPack: effectivePack } : {}),
      ...supportRenderParams(support),
    });

    return {
      support_id: supportId,
      face_side: side,
      svg_length: svg.length,
      pdf_length: pdf.length,
      pack_bound: effectivePack !== undefined,
      pack_finding_count: packFindings.length,
      support_registry: support?.registry ?? 'wayfinding',
      reading_distance_m: support?.reading_distance_m ?? null,
      min_text_font_size_mm: minTextFontSizeMm,
      contrast_finding_count: contrastFindings.length,
      legibility_finding_count: legibilityFindings.length,
    };
  };
}
