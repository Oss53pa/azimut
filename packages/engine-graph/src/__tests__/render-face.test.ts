import { describe, it, expect } from 'vitest';
import { renderFace } from '../render-face.js';
import type { FaceTheme, RenderFaceOptions } from '../render-face.js';
import { resolveFaceContent } from '../resolve-face.js';
import type { ResolvedFace } from '../resolve-face.js';
import { refMultilevel } from '@azimut/testkit';
import type { FaceTemplate, TravelProfile } from '@azimut/core-model';

const theme: FaceTheme = {
  background: 'tok-bg',
  text_primary: 'tok-txt',
  text_secondary: 'tok-sec',
  accent: 'tok-acc',
  border: 'tok-brd',
};

const opts: RenderFaceOptions = {
  width_mm: 600,
  height_mm: 400,
  theme,
  font_family: 'Helvetica',
};

function getProfile(key: string): TravelProfile {
  const p = refMultilevel.travel_profiles.find((pr) => pr.key === key);
  if (!p) throw new Error(`No profile: ${key}`);
  return p;
}

function getTemplate(id: string): FaceTemplate {
  const t = refMultilevel.face_templates.find((tpl) => tpl.id === id);
  if (!t) throw new Error(`No template: ${id}`);
  return t;
}

function resolveFace(): ResolvedFace {
  const result = resolveFaceContent(
    refMultilevel,
    getTemplate('ftpl-dir-front'),
    'n-ml-hall',
    getProfile('standard'),
  );
  if (!result.ok) throw new Error('resolve failed');
  return result.value;
}

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

  it('renders arrow block', () => {
    const face: ResolvedFace = {
      template_id: 'test',
      support_type_key: 'directional',
      side: 'front',
      blocks: [
        {
          kind: 'arrow',
          ordinal: 0,
          region: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 100 },
          content: { type: 'arrow', direction: 'right' },
        },
      ],
    };
    const svg = renderFace(face, opts);
    expect(svg).toContain('polygon');
  });

  it('renders pictogram with svg_path', () => {
    const face: ResolvedFace = {
      template_id: 'test',
      support_type_key: 'directional',
      side: 'front',
      blocks: [
        {
          kind: 'pictogram',
          ordinal: 0,
          region: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 100 },
          content: {
            type: 'pictogram',
            pictogram_id: 'p1',
            svg_path: 'M0 0L10 10',
          },
        },
      ],
    };
    const svg = renderFace(face, opts);
    expect(svg).toContain('M0 0L10 10');
  });

  it('renders map/logo/emergency from their resolved content (K-Tier-A)', () => {
    const r = { x_pct: 0, y_pct: 0, w_pct: 50, h_pct: 33 };
    const face: ResolvedFace = {
      template_id: 'test', support_type_key: 'directional', side: 'front',
      blocks: [
        {
          kind: 'map', ordinal: 0, region: r,
          content: { type: 'map', plan_svg: '<rect id="plan-svg" />', caption: 'Niveau 0' },
        },
        {
          kind: 'logo', ordinal: 1, region: { ...r, x_pct: 50 },
          content: { type: 'logo', svg_markup: null, label: 'Atlas Studio' },
        },
        {
          kind: 'emergency_info', ordinal: 2, region: { ...r, w_pct: 100, y_pct: 33 },
          content: { type: 'emergency_info', text: 'Sortie de secours', svg_path: 'M0 0L5 5' },
        },
      ],
    };
    const svg = renderFace(face, opts);
    // real content, not placeholders
    expect(svg).toContain('plan-svg'); // embedded plan SVG
    expect(svg).toContain('Atlas Studio'); // logo label fallback
    expect(svg).toContain('Sortie de secours'); // emergency text
    expect(svg).toContain('M0 0L5 5'); // emergency safety pictogram path
    expect(svg).not.toContain('[Plan]');
    expect(svg).not.toContain('[Logo]');
    expect(svg).not.toContain('[Urgence]');
  });

  it('embeds a logo asset when svg_markup is provided', () => {
    const r = { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 100 };
    const face: ResolvedFace = {
      template_id: 'test', support_type_key: 'directional', side: 'front',
      blocks: [
        {
          kind: 'logo', ordinal: 0, region: r,
          content: { type: 'logo', svg_markup: '<circle id="logo-mark" r="1" />', label: 'X' },
        },
      ],
    };
    const svg = renderFace(face, opts);
    expect(svg).toContain('logo-mark');
    expect(svg).not.toContain('>X<');
  });

  it('renders a legend from its entries', () => {
    const r = { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 100 };
    const face: ResolvedFace = {
      template_id: 'test', support_type_key: 'directional', side: 'front',
      blocks: [
        {
          kind: 'legend', ordinal: 0, region: r,
          content: {
            type: 'legend',
            entries: [
              { symbol_path: 'M0 0L3 3', label: 'Ascenseur' },
              { symbol_path: null, label: 'Escalier' },
            ],
          },
        },
      ],
    };
    const svg = renderFace(face, opts);
    expect(svg).toContain('Ascenseur');
    expect(svg).toContain('Escalier');
    expect(svg).toContain('M0 0L3 3');
    expect(svg).not.toContain('[Légende]');
  });

  it('renders free_text block', () => {
    const face: ResolvedFace = {
      template_id: 'test',
      support_type_key: 'directional',
      side: 'front',
      blocks: [
        {
          kind: 'free_text',
          ordinal: 0,
          region: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 100 },
          content: { type: 'free_text', text: 'Bienvenue' },
        },
      ],
    };
    const svg = renderFace(face, opts);
    expect(svg).toContain('Bienvenue');
  });

  it('escapes special characters in text', () => {
    const face: ResolvedFace = {
      template_id: 'test',
      support_type_key: 'directional',
      side: 'front',
      blocks: [
        {
          kind: 'free_text',
          ordinal: 0,
          region: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 100 },
          content: { type: 'free_text', text: 'A & B <c>' },
        },
      ],
    };
    const svg = renderFace(face, opts);
    expect(svg).toContain('A &amp; B &lt;c&gt;');
  });

  it.each([
    ['left', 'rotate(180)'],
    ['up', 'rotate(-90)'],
    ['down', 'rotate(90)'],
    ['forward', 'rotate(0)'],
    ['unknown_dir', 'rotate(0)'],
  ])('renders arrow direction %s with %s', (direction, expected) => {
    const face: ResolvedFace = {
      template_id: 'test',
      support_type_key: 'directional',
      side: 'front',
      blocks: [
        {
          kind: 'arrow',
          ordinal: 0,
          region: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 100 },
          content: { type: 'arrow', direction },
        },
      ],
    };
    const svg = renderFace(face, opts);
    expect(svg).toContain(expected);
  });

  it('renders pictogram placeholder when svg_path is null', () => {
    const face: ResolvedFace = {
      template_id: 'test',
      support_type_key: 'directional',
      side: 'front',
      blocks: [
        {
          kind: 'pictogram',
          ordinal: 0,
          region: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 100 },
          content: {
            type: 'pictogram',
            pictogram_id: null,
            svg_path: null,
          },
        },
      ],
    };
    const svg = renderFace(face, opts);
    expect(svg).toContain('stroke-dasharray="2"');
    expect(svg).not.toContain('<path');
  });

  it('escapes double-quote in text', () => {
    const face: ResolvedFace = {
      template_id: 'test',
      support_type_key: 'directional',
      side: 'front',
      blocks: [
        {
          kind: 'free_text',
          ordinal: 0,
          region: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 100 },
          content: { type: 'free_text', text: 'Salle "A"' },
        },
      ],
    };
    const svg = renderFace(face, opts);
    expect(svg).toContain('Salle &quot;A&quot;');
  });

  it('returns empty string for empty destination list', () => {
    const face: ResolvedFace = {
      template_id: 'test',
      support_type_key: 'directional',
      side: 'front',
      blocks: [
        {
          kind: 'destination_list',
          ordinal: 0,
          region: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 100 },
          content: { type: 'destination_list', entries: [] },
        },
      ],
    };
    const svg = renderFace(face, opts);
    // Only the background rect and SVG shell — no destination text
    const textMatches = svg.match(/<text /g);
    expect(textMatches).toBeNull();
  });

  it('renders destination entry without direction (no arrow polygon)', () => {
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
    const svg = renderFace(face, opts);
    expect(svg).toContain('Accueil');
    expect(svg).not.toContain('<polygon');
  });

  it('renders destination entry with direction and distance', () => {
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
                names: { fr: 'Bureau' },
                direction: 'N',
                distance_m: 15,
              },
            ],
          },
        },
      ],
    };
    const svg = renderFace(face, opts);
    expect(svg).toContain('Bureau');
    expect(svg).toContain('<polygon');
    expect(svg).toContain('15 m');
  });

  it('empty names record falls back to empty string', () => {
    const face: ResolvedFace = {
      template_id: 'ftpl-dir-front',
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
              { destination_id: 'd1', names: {}, direction: 'N', distance_m: 5 },
            ],
          },
        },
      ],
    };
    const svg = renderFace(face, opts);
    // Should render without crashing; empty name produces <text> with no label
    expect(svg).toContain('<text');
    expect(svg).toContain('5 m');
  });

  it('block sort tiebreaks on kind when ordinals equal', () => {
    const face: ResolvedFace = {
      template_id: 'ftpl-dir-front',
      support_type_key: 'directional',
      side: 'front',
      blocks: [
        {
          kind: 'header',
          ordinal: 0,
          region: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 50 },
          content: { type: 'free_text', text: 'HEADER' },
        },
        {
          kind: 'destination_list',
          ordinal: 0,
          region: { x_pct: 0, y_pct: 50, w_pct: 100, h_pct: 50 },
          content: { type: 'destination_list', entries: [] },
        },
      ],
    };
    const svg1 = renderFace(face, opts);
    const svg2 = renderFace(face, opts);
    expect(svg1).toBe(svg2);
    const headerIdx = svg1.indexOf('HEADER');
    expect(headerIdx).toBeGreaterThan(0);
  });

  it('cardinalToAngle falls back to 0 for unknown direction', () => {
    const face: ResolvedFace = {
      template_id: 'test', support_type_key: 'directional', side: 'front',
      blocks: [{ kind: 'destination_list', ordinal: 0,
        region: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 100 },
        content: { type: 'destination_list', entries: [
          { destination_id: 'd1', names: { fr: 'Test' }, direction: 'UNKNOWN', distance_m: 10 },
        ] } }],
    };
    const svg = renderFace(face, opts);
    expect(svg).toContain('rotate(0)');
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
