import { describe, it, expect } from 'vitest';
import { renderIsoView } from '../render-iso.js';
import type { IsoOptions, IsoTheme, IsoMultiLevelMode } from '../render-iso.js';
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

const allMode: IsoMultiLevelMode = { kind: 'all' };

const defaultOptions: IsoOptions = {
  width_px: 800,
  height_px: 600,
  theme,
  font_family: 'Helvetica',
  padding_px: 20,
  show_nodes: true,
  mode: allMode,
};

describe('T-2.7 renderIsoView', () => {
  it('returns error for unknown level', () => {
    const result = renderIsoView(refMultilevel, ['nonexistent'], defaultOptions);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('LAYOUT.ISO_LEVEL_NOT_FOUND');
  });

  it('renders single level with floor and wall polygons', () => {
    const result = renderIsoView(refMultilevel, ['lvl-ml-rdc'], defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.svg).toContain('<svg');
    expect(result.value.svg).toContain('</svg>');
    expect(result.value.svg).toContain('<polygon');
    expect(result.value.svg).toContain('tok-floor');
    expect(result.value.svg.includes('tok-wall-f') || result.value.svg.includes('tok-wall-s')).toBe(true);
  });

  it('renders multiple levels stacked', () => {
    const result = renderIsoView(refMultilevel, ['lvl-ml-rdc', 'lvl-ml-r1'], defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.svg).toContain('<svg');
    expect((result.value.svg.match(/<polygon/g) ?? []).length).toBeGreaterThan(1);
  });

  it('includes node circles when show_nodes is true', () => {
    const result = renderIsoView(refMultilevel, ['lvl-ml-rdc'], defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.svg).toContain('<circle');
    expect(result.value.svg).toContain('tok-node');
  });

  it('hides nodes when show_nodes is false', () => {
    const opts = { ...defaultOptions, show_nodes: false };
    const result = renderIsoView(refMultilevel, ['lvl-ml-rdc'], opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.svg).not.toContain('<circle');
  });

  it('contains no hardcoded hex colors', () => {
    const result = renderIsoView(
      refMultilevel,
      ['lvl-ml-rdc', 'lvl-ml-r1'],
      defaultOptions,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.svg).not.toMatch(/#[0-9a-fA-F]{3,8}/);
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
    expect(result.warnings[0]?.code).toBe('LAYOUT.ISO_EMPTY_LEVELS');
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

describe('D5.4 — hit zones', () => {
  it('returns hit zones in reverse painter order', () => {
    const result = renderIsoView(refMultilevel, ['lvl-ml-rdc'], defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.hitZones.length).toBeGreaterThan(0);
    for (const zone of result.value.hitZones) {
      expect(zone.polygon.length).toBeGreaterThan(0);
      expect(zone.volume_id).toBeTruthy();
    }
  });

  it('hit zones are never stored — recalculated each render', () => {
    const r1 = renderIsoView(refMultilevel, ['lvl-ml-rdc'], defaultOptions);
    const r2 = renderIsoView(refMultilevel, ['lvl-ml-rdc'], defaultOptions);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    expect(r1.value.hitZones).toStrictEqual(r2.value.hitZones);
  });
});

describe('D5.5 — multi-level modes', () => {
  it('active_level mode estompes non-active levels', () => {
    const opts: IsoOptions = {
      ...defaultOptions,
      mode: {
        kind: 'active_level',
        active_level_id: 'lvl-ml-rdc',
        adjacent_opacity: 0.25,
      },
    };
    const result = renderIsoView(
      refMultilevel,
      ['lvl-ml-rdc', 'lvl-ml-r1'],
      opts,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.svg).toContain('opacity="0.25"');
  });

  it('active_level mode keeps active level at full opacity', () => {
    const opts: IsoOptions = {
      ...defaultOptions,
      mode: {
        kind: 'active_level',
        active_level_id: 'lvl-ml-rdc',
        adjacent_opacity: 0.25,
      },
    };
    const result = renderIsoView(
      refMultilevel,
      ['lvl-ml-rdc'],
      opts,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.svg).not.toContain('opacity=');
  });

  it('exploded mode produces different SVG than all mode', () => {
    const allResult = renderIsoView(
      refMultilevel,
      ['lvl-ml-rdc', 'lvl-ml-r1'],
      defaultOptions,
    );
    const explodedOpts: IsoOptions = {
      ...defaultOptions,
      mode: { kind: 'exploded', offset_m: 4 },
    };
    const explodedResult = renderIsoView(
      refMultilevel,
      ['lvl-ml-rdc', 'lvl-ml-r1'],
      explodedOpts,
    );
    expect(allResult.ok).toBe(true);
    expect(explodedResult.ok).toBe(true);
    if (!allResult.ok || !explodedResult.ok) return;
    expect(explodedResult.value.svg).not.toBe(allResult.value.svg);
  });

  it('exploded mode is deterministic (INV-4)', () => {
    const opts: IsoOptions = {
      ...defaultOptions,
      mode: { kind: 'exploded', offset_m: 4 },
    };
    const r1 = renderIsoView(
      refMultilevel,
      ['lvl-ml-rdc', 'lvl-ml-r1'],
      opts,
    );
    const r2 = renderIsoView(
      refMultilevel,
      ['lvl-ml-rdc', 'lvl-ml-r1'],
      opts,
    );
    expect(r1).toStrictEqual(r2);
  });
});

describe('renderIsoView — edge-case geometry', () => {
  it('skips walls for zero-height volume', () => {
    const site = {
      ...refMultilevel,
      volumes: refMultilevel.volumes.map((v) => ({ ...v, height_m: 0 })),
    };
    const result = renderIsoView(site, ['lvl-ml-rdc'], defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Top-face polygons present, but no wall polygons
    expect(result.value.svg).toContain('<polygon');
    expect(result.value.svg).not.toContain('tok-wall-f');
    expect(result.value.svg).not.toContain('tok-wall-s');
  });

  it('renders bare footprints without matching volume', () => {
    // Remove all volumes → all footprints become "bare"
    const site = { ...refMultilevel, volumes: [] };
    const result = renderIsoView(site, ['lvl-ml-rdc'], defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Floor polygons drawn for bare footprints
    expect(result.value.svg).toContain('tok-floor');
    expect(result.value.svg).toContain('<polygon');
    // No wall polygons since no volumes exist
    expect(result.value.svg).not.toContain('tok-wall-f');
  });

  it('node Z falls back to elevation_m when no volumes', () => {
    const site = { ...refMultilevel, volumes: [] };
    const opts = { ...defaultOptions, show_nodes: true };
    const result = renderIsoView(site, ['lvl-ml-rdc'], opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.svg).toContain('<circle');
  });

  it('single-vertex footprint skips walls (n < 2 guard)', () => {
    const site = {
      ...refMultilevel,
      footprints: [
        {
          id: 'fp-single',
          org_id: 'org-test-001',
          level_id: 'lvl-ml-rdc',
          geometry: { vertices: [{ x_m: 5, y_m: 5 }] },
          kind: 'room' as const,
        },
      ],
      volumes: [
        {
          id: 'vol-single',
          org_id: 'org-test-001',
          footprint_id: 'fp-single',
          base_elevation_m: 0,
          height_m: 3,
          material_key: 'concrete',
        },
      ],
    };
    const result = renderIsoView(site, ['lvl-ml-rdc'], defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Top face polygon exists but no walls
    expect(result.value.svg).toContain('<polygon');
    expect(result.value.svg).not.toContain('tok-wall-f');
    expect(result.value.svg).not.toContain('tok-wall-s');
  });

  it('back-face culling renders fewer walls than footprint edges', () => {
    const result = renderIsoView(refMultilevel, ['lvl-ml-rdc'], defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Count fill="tok-wall-f" or fill="tok-wall-s" (not stroke tok-wall-str)
    const wallFills = (result.value.svg.match(/fill="tok-wall-[fs]"/g) ?? []).length;
    // A rectangular footprint has 4 edges; back-face culling shows only 2
    expect(wallFills).toBe(2);
  });

  it('active_level mode with adjacent_opacity=1 omits opacity wrapper', () => {
    const opts: IsoOptions = {
      ...defaultOptions,
      mode: { kind: 'active_level', active_level_id: 'lvl-ml-rdc', adjacent_opacity: 1 },
    };
    const result = renderIsoView(refMultilevel, ['lvl-ml-rdc', 'lvl-ml-r1'], opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.svg).not.toContain('opacity=');
  });

  it('empty levelIds array produces ISO_EMPTY_LEVELS with level_count 0', () => {
    const result = renderIsoView(refMultilevel, [], defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]?.code).toBe('LAYOUT.ISO_EMPTY_LEVELS');
    expect(result.warnings[0]?.params).toHaveProperty('level_count', 0);
  });

  it('same-ordinal levels sort deterministically by id', () => {
    const sameOrdinalSite = {
      ...refMultilevel,
      levels: [
        { id: 'lvl-b', org_id: 'org-test-001', building_id: 'bldg-ml-001', name: 'B', ordinal: 0, elevation_m: 0 },
        { id: 'lvl-a', org_id: 'org-test-001', building_id: 'bldg-ml-001', name: 'A', ordinal: 0, elevation_m: 0 },
      ],
      footprints: [
        { id: 'fp-a', org_id: 'org-test-001', level_id: 'lvl-a', kind: 'floor', geometry: { vertices: [{ x_m: 0, y_m: 0 }, { x_m: 5, y_m: 0 }, { x_m: 5, y_m: 5 }, { x_m: 0, y_m: 5 }] } },
        { id: 'fp-b', org_id: 'org-test-001', level_id: 'lvl-b', kind: 'floor', geometry: { vertices: [{ x_m: 10, y_m: 0 }, { x_m: 15, y_m: 0 }, { x_m: 15, y_m: 5 }, { x_m: 10, y_m: 5 }] } },
      ],
      volumes: [
        { id: 'vol-a', org_id: 'org-test-001', footprint_id: 'fp-a', base_elevation_m: 0, height_m: 3, material_key: 'concrete' },
        { id: 'vol-b', org_id: 'org-test-001', footprint_id: 'fp-b', base_elevation_m: 0, height_m: 3, material_key: 'concrete' },
      ],
      graph: { ...refMultilevel.graph, nodes: [], edges: [] },
    };
    // Provide level IDs in both orders — result must be identical
    const r1 = renderIsoView(sameOrdinalSite, ['lvl-b', 'lvl-a'], defaultOptions);
    const r2 = renderIsoView(sameOrdinalSite, ['lvl-a', 'lvl-b'], defaultOptions);
    expect(r1).toStrictEqual(r2);
  });

  it('overlapping footprints on same level produce GEOM.FOOTPRINTS_OVERLAP warning', () => {
    const overlapSite = {
      ...refMultilevel,
      levels: [
        { id: 'lvl-ol', org_id: 'org-test-001', building_id: 'bldg-ml-001', name: 'Overlap', ordinal: 0, elevation_m: 0 },
      ],
      footprints: [
        { id: 'fp-1', org_id: 'org-test-001', level_id: 'lvl-ol', kind: 'floor', geometry: { vertices: [{ x_m: 0, y_m: 0 }, { x_m: 10, y_m: 0 }, { x_m: 10, y_m: 10 }, { x_m: 0, y_m: 10 }] } },
        { id: 'fp-2', org_id: 'org-test-001', level_id: 'lvl-ol', kind: 'floor', geometry: { vertices: [{ x_m: 5, y_m: 5 }, { x_m: 15, y_m: 5 }, { x_m: 15, y_m: 15 }, { x_m: 5, y_m: 15 }] } },
      ],
      volumes: [
        { id: 'vol-1', org_id: 'org-test-001', footprint_id: 'fp-1', base_elevation_m: 0, height_m: 3, material_key: 'concrete' },
        { id: 'vol-2', org_id: 'org-test-001', footprint_id: 'fp-2', base_elevation_m: 0, height_m: 3, material_key: 'concrete' },
      ],
      graph: { ...refMultilevel.graph, nodes: [], edges: [] },
    };
    const result = renderIsoView(overlapSite, ['lvl-ol'], defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const overlap = result.warnings.find((w) => w.code === 'GEOM.FOOTPRINTS_OVERLAP');
    expect(overlap).toBeDefined();
    expect(overlap?.params).toHaveProperty('footprint_a', 'fp-1');
    expect(overlap?.params).toHaveProperty('footprint_b', 'fp-2');
  });

  it('renders mixed bare and volume footprints on same level', () => {
    const site = { ...refMultilevel, footprints: [...refMultilevel.footprints,
      { id: 'fp-bare-mix', org_id: 'org-test-001', level_id: 'lvl-ml-rdc', kind: 'corridor' as const,
        geometry: { vertices: [{ x_m: 50, y_m: 0 }, { x_m: 60, y_m: 0 }, { x_m: 60, y_m: 10 }, { x_m: 50, y_m: 10 }] } }] };
    const result = renderIsoView(site, ['lvl-ml-rdc'], defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Both bare (tok-floor) and volume-backed (tok-wall) polygons present
    expect(result.value.svg).toContain('tok-floor');
    expect(result.value.svg).toMatch(/tok-wall/);
  });
});
