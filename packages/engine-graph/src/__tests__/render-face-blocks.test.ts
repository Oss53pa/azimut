import { describe, it, expect } from 'vitest';
import { renderFace } from '../render-face.js';
import type { ResolvedFace } from '../resolve-face.js';
import { opts } from './render-face-fixtures.js';

// Suite de render-face.test.ts : un essai par nature de bloc.
describe('T-2.15 renderFace', () => {
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
});
