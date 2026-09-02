import type { SiteData } from '@azimut/core-model';
import {
  resolveFaceContent,
  renderFace,
} from '@azimut/engine-graph';
import type { FaceTheme } from '@azimut/engine-graph';
import { exportArtworkPdf } from '@azimut/engine-artwork';
import type { PdfTarget } from '@azimut/engine-artwork';
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

    const template = site.face_templates.find(
      (t) => t.id === templateId,
    );
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const profile = site.travel_profiles.find(
      (p) => p.key === profileKey,
    );
    if (!profile) {
      throw new Error(`Profile not found: ${profileKey}`);
    }

    const supportType = site.support_types.find(
      (st) => st.key === template.support_type_key,
    );
    const face = supportType?.faces.find(
      (f) => f.side === template.side,
    );
    const widthMm = face?.default_width_mm ?? 600;
    const heightMm = face?.default_height_mm ?? 400;

    const resolveResult = resolveFaceContent(
      site,
      template,
      nodeId,
      profile,
    );
    if (!resolveResult.ok) {
      const codes = resolveResult.findings.map((f) => f.code).join(', ');
      throw new Error(`Resolve failed: ${codes}`);
    }

    const svg = renderFace(resolveResult.value, {
      width_mm: widthMm,
      height_mm: heightMm,
      theme,
      font_family,
    });

    const pdf = await exportArtworkPdf({
      svg,
      target: pdf_target,
      title: `${supportId} — ${template.side}`,
      width_mm: widthMm,
      height_mm: heightMm,
      creation_date,
    });

    return {
      support_id: supportId,
      face_side: template.side,
      svg_length: svg.length,
      pdf_length: pdf.length,
    };
  };
}
