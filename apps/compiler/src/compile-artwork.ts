import type { SiteData } from '@azimut/core-model';
import type { FaceTheme, LoadedRulesPack } from '@azimut/engine-graph';
import type { PdfTarget } from '@azimut/engine-artwork';
import { renderArtwork } from './artwork.js';
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
   * Optional rules pack; when supplied, the face theme's contrast is checked.
   * The site→pack binding exists in the model (A5.8 `site_rules_binding` /
   * `Site.rules_pack_id`); a resolver from that id to a loaded pack is still
   * to come, so for now the pack is passed in explicitly.
   */
  readonly rules_pack?: LoadedRulesPack;
};

export function createArtworkHandler(
  context: CompileContext,
): (job: Job) => Promise<Record<string, unknown>> {
  const { site, theme, font_family, pdf_target, creation_date, rules_pack } = context;

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

    const { svg, pdf, side, contrastFindings } = await renderArtwork({
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
      ...(rules_pack !== undefined ? { rulesPack: rules_pack } : {}),
    });

    return {
      support_id: supportId,
      face_side: side,
      svg_length: svg.length,
      pdf_length: pdf.length,
      contrast_finding_count: contrastFindings.length,
    };
  };
}
