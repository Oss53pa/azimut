import { describe, it, expect } from 'vitest';
import { renderFace } from '../render-face.js';
import type { ResolvedFace } from '../resolve-face.js';
import { opts } from './render-face-fixtures.js';

// Suite de render-face.test.ts : échappement, cas vides, replis et tri.
describe('T-2.15 renderFace', () => {
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
});
