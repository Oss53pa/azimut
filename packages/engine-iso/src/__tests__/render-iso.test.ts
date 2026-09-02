import { describe, it, expect } from 'vitest';
import { renderIsoView } from '../render-iso.js';
import type { IsoOptions, IsoTheme } from '../render-iso.js';
import { refMultilevel } from '@azimut/testkit';

const theme: IsoTheme = {
  background: 'tok-bg',
  floor_top: 'tok-floor',
  floor_stroke: 'tok-floor-s',
  wall_front: 'tok-wall-f',
  wall_side: 'tok-wall-s',
  wall_stroke: 'tok-wall-str',
  node_fill: 'tok-node',
  node_stroke: 'tok-node-s',
  text_primary: 'tok-txt',
};

const defaultOptions: IsoOptions = {
  width_px: 800,
  height_px: 600,
  theme,
  font_family: 'Helvetica',
  padding_px: 20,
  show_nodes: true,
};

describe('T-2.7 renderIsoView', () => {
  it('returns error for unknown level', () => {
    const result = renderIsoView(refMultilevel, ['nonexistent'], defaultOptions);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('ISO.LEVEL_NOT_FOUND');
  });

  it('renders single level as valid SVG', () => {
    const result = renderIsoView(refMultilevel, ['lvl-ml-rdc'], defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('<svg');
    expect(result.value).toContain('</svg>');
  });

  it('renders multiple levels stacked', () => {
    const result = renderIsoView(
      refMultilevel,
      ['lvl-ml-rdc', 'lvl-ml-r1'],
      defaultOptions,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('<svg');
    const polygonCount = (result.value.match(/<polygon/g) ?? []).length;
    expect(polygonCount).toBeGreaterThan(1);
  });

  it('includes floor top polygons', () => {
    const result = renderIsoView(refMultilevel, ['lvl-ml-rdc'], defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('<polygon');
    expect(result.value).toContain('tok-floor');
  });

  it('includes wall polygons for volumes with height', () => {
    const result = renderIsoView(refMultilevel, ['lvl-ml-rdc'], defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const hasWallFront = result.value.includes('tok-wall-f');
    const hasWallSide = result.value.includes('tok-wall-s');
    expect(hasWallFront || hasWallSide).toBe(true);
  });

  it('includes node circles when show_nodes is true', () => {
    const result = renderIsoView(refMultilevel, ['lvl-ml-rdc'], defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('<circle');
    expect(result.value).toContain('tok-node');
  });

  it('hides nodes when show_nodes is false', () => {
    const opts = { ...defaultOptions, show_nodes: false };
    const result = renderIsoView(refMultilevel, ['lvl-ml-rdc'], opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toContain('<circle');
  });

  it('contains no hardcoded hex colors', () => {
    const result = renderIsoView(
      refMultilevel,
      ['lvl-ml-rdc', 'lvl-ml-r1'],
      defaultOptions,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('is deterministic (INV-4)', () => {
    const r1 = renderIsoView(
      refMultilevel,
      ['lvl-ml-rdc', 'lvl-ml-r1'],
      defaultOptions,
    );
    const r2 = renderIsoView(
      refMultilevel,
      ['lvl-ml-rdc', 'lvl-ml-r1'],
      defaultOptions,
    );
    expect(r1).toStrictEqual(r2);
  });

  it('warns on empty levels', () => {
    const emptySite = {
      ...refMultilevel,
      levels: [
        ...refMultilevel.levels,
        {
          id: 'lvl-empty',
          org_id: 'org-test-001',
          building_id: 'bldg-ml-001',
          name: 'Vide',
          ordinal: 99,
          elevation_m: 99,
        },
      ],
      footprints: [],
      volumes: [],
      graph: { ...refMultilevel.graph, nodes: [], edges: [] },
    };
    const result = renderIsoView(emptySite, ['lvl-empty'], defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]?.code).toBe('ISO.EMPTY_LEVELS');
  });

  it('level order is deterministic regardless of input order', () => {
    const r1 = renderIsoView(
      refMultilevel,
      ['lvl-ml-r1', 'lvl-ml-rdc'],
      defaultOptions,
    );
    const r2 = renderIsoView(
      refMultilevel,
      ['lvl-ml-rdc', 'lvl-ml-r1'],
      defaultOptions,
    );
    expect(r1).toStrictEqual(r2);
  });
});
