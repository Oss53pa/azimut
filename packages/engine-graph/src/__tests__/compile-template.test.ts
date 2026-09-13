import { describe, it, expect } from 'vitest';
import { templateSchema } from '@azimut/core-model';
import { refMultilevel } from '@azimut/testkit';
import type { TravelProfile } from '@azimut/core-model';
import { compileTemplate } from '../compile-template.js';
import { resolveFaceContent } from '../resolve-face.js';
import { renderFace } from '../render-face.js';
import type { FaceTheme } from '../render-face.js';

const dims = { width_mm: 600, height_mm: 400 };

const theme: FaceTheme = {
  background: 'tok-bg',
  text_primary: 'tok-txt',
  text_secondary: 'tok-sec',
  accent: 'tok-acc',
  border: 'tok-brd',
};

function profile(): TravelProfile {
  const p = refMultilevel.travel_profiles.find((pr) => pr.key === 'standard');
  if (!p) throw new Error('no profile');
  return p;
}

describe('D8 — compileTemplate', () => {
  it('maps grid areas to percentage regions', () => {
    // 2 columns, no margin/gutter → each column is 50% wide.
    const tpl = templateSchema.parse({
      key: 'grid2',
      faceCount: 1,
      grid: { columns: 2, margin_mm: 0, gutter_mm: 0 },
      blocks: [
        {
          index: 0,
          kind: 'resolved',
          binding: { source: 'route', field: 'nextDestinations' },
          area: { col: 1, colSpan: 1, row: 1 },
        },
        {
          index: 1,
          kind: 'map',
          binding: { source: 'route', field: 'map' },
          area: { col: 2, colSpan: 1, row: 1 },
        },
      ],
    });
    const compiled = compileTemplate(tpl, { width_mm: 100, height_mm: 100 });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const [a, b] = compiled.value.blocks;
    expect(a?.region.x_pct).toBeCloseTo(0);
    expect(a?.region.w_pct).toBeCloseTo(50);
    expect(a?.region.y_pct).toBeCloseTo(0);
    expect(a?.region.h_pct).toBeCloseTo(100);
    expect(b?.region.x_pct).toBeCloseTo(50);
    expect(b?.region.w_pct).toBeCloseTo(50);
  });

  it('infers row count from max(area.row)', () => {
    const tpl = templateSchema.parse({
      key: 'rows',
      faceCount: 1,
      grid: { columns: 1, margin_mm: 0, gutter_mm: 0 },
      blocks: [
        { index: 0, kind: 'free', area: { col: 1, colSpan: 1, row: 1 } },
        { index: 1, kind: 'free', area: { col: 1, colSpan: 1, row: 2 } },
      ],
    });
    const compiled = compileTemplate(tpl, { width_mm: 100, height_mm: 100 });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    // Two rows → each 50% tall, second row starts at 50%.
    expect(compiled.value.blocks[0]?.region.h_pct).toBeCloseTo(50);
    expect(compiled.value.blocks[1]?.region.y_pct).toBeCloseTo(50);
  });

  it('rejects an overflowing template with LAYOUT.TEMPLATE_INVALID', () => {
    const tpl = templateSchema.parse({
      key: 'bad',
      faceCount: 1,
      grid: { columns: 4, margin_mm: 0, gutter_mm: 0 },
      blocks: [
        {
          index: 0,
          kind: 'resolved',
          binding: { source: 'route', field: 'nextDestinations' },
          area: { col: 3, colSpan: 4, row: 1 },
        },
      ],
    });
    const compiled = compileTemplate(tpl, dims);
    expect(compiled.ok).toBe(false);
    if (compiled.ok) return;
    expect(compiled.findings[0]?.code).toBe('LAYOUT.TEMPLATE_INVALID');
  });

  it('rejects an unsupported binding with LAYOUT.TEMPLATE_BINDING_UNSUPPORTED', () => {
    const tpl = templateSchema.parse({
      key: 'unknown-binding',
      faceCount: 1,
      grid: { columns: 4, margin_mm: 0, gutter_mm: 0 },
      blocks: [
        {
          index: 0,
          kind: 'resolved',
          binding: { source: 'weather', field: 'forecast' },
          area: { col: 1, colSpan: 4, row: 1 },
        },
      ],
    });
    const compiled = compileTemplate(tpl, dims);
    expect(compiled.ok).toBe(false);
    if (compiled.ok) return;
    expect(compiled.findings[0]?.code).toBe('LAYOUT.TEMPLATE_BINDING_UNSUPPORTED');
  });

  it('applies binding.limit to the destination list', () => {
    const tpl = templateSchema.parse({
      key: 'limited',
      faceCount: 1,
      grid: { columns: 1, margin_mm: 0, gutter_mm: 0 },
      blocks: [
        {
          index: 0,
          kind: 'resolved',
          binding: { source: 'route', field: 'nextDestinations', limit: 1 },
          area: { col: 1, colSpan: 1, row: 1 },
        },
      ],
    });
    const compiled = compileTemplate(tpl, dims);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const resolved = resolveFaceContent(
      refMultilevel, compiled.value, 'n-ml-hall', profile(),
    );
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const list = resolved.value.blocks.find(
      (b) => b.content.type === 'destination_list',
    );
    if (list && list.content.type === 'destination_list') {
      expect(list.content.entries.length).toBe(1);
    }
  });
});

describe('D8.4 — a template added purely by file renders (no code change)', () => {
  it('authors a Template as data, compiles and renders a valid face', () => {
    // This object is the only thing an author supplies — no engine code is
    // touched. It flows: schema.parse → compileTemplate → resolveFaceContent
    // → renderFace, and must produce a valid SVG.
    const authored = {
      key: 'directional-2col',
      faceCount: 1,
      grid: { columns: 12, margin_mm: 20, gutter_mm: 10 },
      blocks: [
        {
          index: 0,
          kind: 'resolved',
          binding: { source: 'site', field: 'name' },
          area: { col: 1, colSpan: 12, row: 1 },
          style: { role: 'primary', align: 'center' },
        },
        {
          index: 1,
          kind: 'resolved',
          binding: { source: 'route', field: 'nextDestinations', limit: 4 },
          area: { col: 1, colSpan: 9, row: 2 },
          style: { role: 'primary', align: 'left' },
        },
        {
          index: 2,
          kind: 'legend',
          binding: { source: 'route', field: 'legend' },
          area: { col: 10, colSpan: 3, row: 2 },
        },
      ],
    };

    const tpl = templateSchema.parse(authored);
    const compiled = compileTemplate(tpl, dims);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const resolved = resolveFaceContent(
      refMultilevel, compiled.value, 'n-ml-hall', profile(),
    );
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const svg = renderFace(resolved.value, {
      width_mm: dims.width_mm,
      height_mm: dims.height_mm,
      theme,
      font_family: 'Helvetica',
      lang: 'fr',
    });

    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    // Header resolved from site.name, destinations resolved from the graph.
    expect(svg).toContain('Site multi-niveaux');
    expect(svg).toContain('Bureau RDC');
    // K-Tier-A: a legend block with no configured entries renders nothing —
    // no more placeholder token.
    expect(svg).not.toContain('[Légende]');
  });
});
