import { describe, it, expect } from 'vitest';
import { renderFace } from '../render-face.js';
import type { ResolvedFace } from '../resolve-face.js';
import { opts, resolveFace } from './render-face-fixtures.js';

describe('T-2.15 renderFace', () => {
  it('produces valid SVG markup', () => {
    const face = resolveFace();
    const svg = renderFace(face, opts);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('viewBox="0 0 600 400"');
  });

  it('renders header block with site name', () => {
    const face = resolveFace();
    const svg = renderFace(face, opts);
    expect(svg).toContain('Site multi-niveaux');
  });

  it('renders destination list entries', () => {
    const face = resolveFace();
    const svg = renderFace(face, opts);
    expect(svg).toContain('Bureau RDC');
  });

  it('uses theme colors from options, not hardcoded hex', () => {
    const face = resolveFace();
    const svg = renderFace(face, opts);
    expect(svg).toContain('tok-bg');
    expect(svg).toContain('tok-txt');
    expect(svg).toContain('tok-acc');
    expect(svg).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('uses font family from options', () => {
    const face = resolveFace();
    const svg = renderFace(face, opts);
    expect(svg).toContain('Helvetica');
  });

  it('sets width and height attributes in mm', () => {
    const face = resolveFace();
    const svg = renderFace(face, opts);
    expect(svg).toContain('width="600mm"');
    expect(svg).toContain('height="400mm"');
  });

  it('renders the destination name for the requested active language (D12)', () => {
    const face: ResolvedFace = {
      template_id: 'test',
      support_type_key: 'directional',
      side: 'front',
      blocks: [
        {
          kind: 'destination_list',
          ordinal: 0,
          region: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 100 },
          content: {
            type: 'destination_list',
            entries: [
              {
                destination_id: 'd1',
                names: { fr: 'Bibliothèque', en: 'Library' },
                direction: null,
                distance_m: null,
              },
            ],
          },
        },
      ],
    };
    const fr = renderFace(face, { ...opts, lang: 'fr' });
    expect(fr).toContain('Bibliothèque');
    expect(fr).not.toContain('Library');

    const en = renderFace(face, { ...opts, lang: 'en' });
    expect(en).toContain('Library');
    expect(en).not.toContain('Bibliothèque');
  });

  it('falls back to the first available variant when the language is missing', () => {
    const face: ResolvedFace = {
      template_id: 'test',
      support_type_key: 'directional',
      side: 'front',
      blocks: [
        {
          kind: 'destination_list',
          ordinal: 0,
          region: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 100 },
          content: {
            type: 'destination_list',
            entries: [
              {
                destination_id: 'd1',
                names: { fr: 'Accueil' },
                direction: null,
                distance_m: null,
              },
            ],
          },
        },
      ],
    };
    // 'en' is absent → falls back to the only available variant.
    expect(renderFace(face, { ...opts, lang: 'en' })).toContain('Accueil');
    // Omitting lang keeps the previous behavior (first available variant).
    expect(renderFace(face, opts)).toContain('Accueil');
  });

  describe('determinism (INV-4)', () => {
    it('same result on two calls', () => {
      const face = resolveFace();
      const svg1 = renderFace(face, opts);
      const svg2 = renderFace(face, opts);
      expect(svg1).toBe(svg2);
    });
  });
});
