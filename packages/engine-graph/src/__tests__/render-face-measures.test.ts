import { describe, it, expect } from 'vitest';
import {
  renderFace,
  renderFaceWithMeasures,
  destinationListFontSizeMm,
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
