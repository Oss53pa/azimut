import type { SiteData } from '@azimut/core-model';
import type { FaceTheme } from '@azimut/engine-graph';
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
};

export function createArtworkHandler(
  context: CompileContext,
): (job: Job) => Promise<Record<string, unknown>> {
  const { site, theme, font_family, pdf_target, creation_date } = context;

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

    const { svg, pdf, side } = await renderArtwork({
      site,
      theme,
      fontFamily: font_family,
      pdfTarget: pdf_target,
      creationDate: creation_date,
      nodeId,
      templateId,
      profileKey,
      title: `${supportId} — ${template.side}`,
    });

    return {
      support_id: supportId,
      face_side: side,
      svg_length: svg.length,
      pdf_length: pdf.length,
    };
  };
}
