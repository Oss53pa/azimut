import { describe, it, expect } from 'vitest';
import {
  renderFace,
  renderFaceWithMeasures,
  destinationListFontSizeMm,
  faceUsesAccent,
  checkFaceContentFit,
  headerFontSizeMm,
  type TextMeasure,
} from '../render-face.js';
import type { FaceTheme, RenderFaceOptions } from '../render-face.js';
import { resolveFaceContent } from '../resolve-face.js';
import type { ResolvedFace } from '../resolve-face.js';
import { refMultilevel } from '@azimut/testkit';
import type { FaceTemplate, TravelProfile } from '@azimut/core-model';

const theme: FaceTheme = {
  background: 'tok-bg', text_primary: 'tok-txt', text_secondary: 'tok-sec',
  accent: 'tok-acc', border: 'tok-brd',
};
const opts: RenderFaceOptions = {
  width_mm: 600, height_mm: 400, theme, font_family: 'Helvetica',
};

function resolveFace(): ResolvedFace {
  const profile = refMultilevel.travel_profiles.find((p) => p.key === 'standard');
  const template = refMultilevel.face_templates.find(
    (t: FaceTemplate) => t.id === 'ftpl-dir-front',
  );
  if (!profile || !template) throw new Error('fixture incomplete');
  const result = resolveFaceContent(refMultilevel, template, 'n-ml-hall', profile as TravelProfile);
  if (!result.ok) throw new Error('resolve failed');
  return result.value;
}

describe('destinationListFontSizeMm', () => {
  it('is zero for an empty list', () => {
    expect(destinationListFontSizeMm(400, 0)).toBe(0);
  });

  it('shrinks as the entry count grows (more lines, smaller text)', () => {
    const few = destinationListFontSizeMm(400, 2);
    const many = destinationListFontSizeMm(400, 12);
    expect(few).toBeGreaterThan(many);
    expect(many).toBeGreaterThan(0);
  });

  it('is capped by the per-line ceiling for a short list', () => {
    // With 1 entry the ceiling h*0.15 binds, not h/(n+0.5).
    expect(destinationListFontSizeMm(400, 1)).toBeCloseTo(400 * 0.15 * 0.6, 6);
  });
});

describe('renderFaceWithMeasures', () => {
  it('returns the same SVG as renderFace (single layout pass, INV-4)', () => {
    const face = resolveFace();
    const withMeasures = renderFaceWithMeasures(face, opts);
    expect(withMeasures.svg).toBe(renderFace(face, opts));
  });

  it('reports a positive denomination-text size for a directional face', () => {
    const face = resolveFace();
    const result = renderFaceWithMeasures(face, opts);
    expect(result.min_text_font_size_mm).not.toBeNull();
    expect(result.min_text_font_size_mm as number).toBeGreaterThan(0);
  });

  it('reports null when the face carries no destination list', () => {
    const face: ResolvedFace = {
      template_id: 'test', support_type_key: 'directional', side: 'front',
      blocks: [{
        kind: 'header', ordinal: 0,
        region: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 20 },
        content: { type: 'header', site_name: 'X' },
      }],
    };
    expect(renderFaceWithMeasures(face, opts).min_text_font_size_mm).toBeNull();
  });

  it('is deterministic across two calls', () => {
    const face = resolveFace();
    expect(renderFaceWithMeasures(face, opts)).toStrictEqual(
      renderFaceWithMeasures(face, opts),
    );
  });
});

describe('faceUsesAccent', () => {
  it('is true for a face with a header (accent bar)', () => {
    const face: ResolvedFace = {
      template_id: 't', support_type_key: 'directional', side: 'front',
      blocks: [{
        kind: 'header', ordinal: 0,
        region: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 20 },
        content: { type: 'header', site_name: 'X' },
      }],
    };
    expect(faceUsesAccent(face)).toBe(true);
  });

  it('is false for a text-only face (no accent-drawn content)', () => {
    const face: ResolvedFace = {
      template_id: 't', support_type_key: 'directional', side: 'front',
      blocks: [{
        kind: 'free_text', ordinal: 0,
        region: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 100 },
        content: { type: 'free_text', text: 'Hello' },
      }],
    };
    expect(faceUsesAccent(face)).toBe(false);
  });

  it('is true only when a destination list actually draws direction arrows', () => {
    const listFace = (direction: string | null): ResolvedFace => ({
      template_id: 't', support_type_key: 'directional', side: 'front',
      blocks: [{
        kind: 'destination_list', ordinal: 0,
        region: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 100 },
        content: {
          type: 'destination_list',
          entries: [{ destination_id: 'd1', names: { fr: 'A' }, distance_m: null, direction }],
        },
      }],
    });
    expect(faceUsesAccent(listFace('N'))).toBe(true);
    expect(faceUsesAccent(listFace(null))).toBe(false);
  });
});

describe('checkFaceContentFit (LAYOUT.CONTENT_OVERFLOW)', () => {
  // Stub metrics: width ≈ characters × em size. No real table ships (G5.1).
  const measure: TextMeasure = (text, fontSizeMm) => text.length * fontSizeMm;
  const narrow = { ...opts, width_mm: 100, height_mm: 100 };

  const headerFace = (name: string): ResolvedFace => ({
    template_id: 't', support_type_key: 'directional', side: 'front',
    blocks: [{
      kind: 'header', ordinal: 0,
      region: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 100 },
      content: { type: 'header', site_name: name },
    }],
  });

  it('flags a header name wider than its block', () => {
    // block width 100 mm, font 6 mm → 40 chars ≈ 240 mm > 100.
    const findings = checkFaceContentFit(headerFace('A'.repeat(40)), narrow, measure);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.code).toBe('LAYOUT.CONTENT_OVERFLOW');
  });

  it('passes a short name that fits', () => {
    expect(checkFaceContentFit(headerFace('Hall'), narrow, measure)).toEqual([]);
  });

  it('measures the header at the same size the renderer draws', () => {
    // headerFontSizeMm is the shared source: 6 mm here (min(100*0.5, 100*0.06)).
    expect(headerFontSizeMm(100, 100)).toBe(6);
  });

  it('flags an overlong destination name', () => {
    const face: ResolvedFace = {
      template_id: 't', support_type_key: 'directional', side: 'front',
      blocks: [{
        kind: 'destination_list', ordinal: 0,
        region: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 100 },
        content: {
          type: 'destination_list',
          entries: [{
            destination_id: 'd1', names: { fr: 'X'.repeat(60) },
            distance_m: null, direction: null,
          }],
        },
      }],
    };
    const findings = checkFaceContentFit(face, narrow, measure);
    expect(findings.some((f) => f.code === 'LAYOUT.CONTENT_OVERFLOW')).toBe(true);
  });
});
