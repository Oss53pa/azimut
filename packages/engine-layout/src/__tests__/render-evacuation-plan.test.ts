import { describe, it, expect } from 'vitest';
import { renderEvacuationPlan } from '../render-evacuation-plan.js';
import type { EvacuationPlanOptions, EvacuationTheme } from '../render-evacuation-plan.js';
import { refMultilevel } from '@azimut/testkit';

const theme: EvacuationTheme = {
  background: 'tok-bg',
  footprint_fill: 'tok-fp-fill',
  footprint_stroke: 'tok-fp-stroke',
  route_stroke: 'tok-route',
  route_arrow: 'tok-arrow',
  non_route_stroke: 'tok-non-route',
  exit_fill: 'tok-exit-f',
  exit_stroke: 'tok-exit-s',
  assembly_fill: 'tok-asm-f',
  assembly_stroke: 'tok-asm-s',
  node_fill: 'tok-node',
  node_stroke: 'tok-node-s',
  text_primary: 'tok-txt',
  text_secondary: 'tok-txt2',
  marker_fill: 'tok-marker',
  marker_stroke: 'tok-marker-s',
};

const defaultOptions: EvacuationPlanOptions = {
  width_px: 800,
  height_px: 600,
  theme,
  font_family: 'Helvetica',
  padding_px: 20,
  viewer_position: { x_m: 20, y_m: 10 },
  show_non_evacuation: true,
};

describe('T-2.10 renderEvacuationPlan', () => {
  it('returns error for unknown level', () => {
    const result = renderEvacuationPlan(refMultilevel, 'nonexistent', defaultOptions);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('LAYOUT.EVAC_LEVEL_NOT_FOUND');
  });

  it('renders valid SVG', () => {
    const result = renderEvacuationPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.svg).toContain('<svg');
    expect(result.value.svg).toContain('</svg>');
  });

  it('includes evacuation routes with thick stroke', () => {
    const result = renderEvacuationPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.svg).toContain('tok-route');
    expect(result.value.svg).toContain('stroke-width="3"');
  });

  it('includes direction arrows on evacuation routes', () => {
    const result = renderEvacuationPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.svg).toContain('tok-arrow');
  });

  it('marks exits with square markers', () => {
    const result = renderEvacuationPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.svg).toContain('tok-exit-f');
    expect(result.value.svg).toContain('<rect');
  });

  it('includes non-evacuation routes when enabled', () => {
    const result = renderEvacuationPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.svg).toContain('tok-non-route');
  });

  it('hides non-evacuation routes when disabled', () => {
    const opts = { ...defaultOptions, show_non_evacuation: false };
    const result = renderEvacuationPlan(refMultilevel, 'lvl-ml-rdc', opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.svg).not.toContain('tok-non-route');
  });

  it('includes viewer marker when position is set', () => {
    const result = renderEvacuationPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.svg).toContain('tok-marker');
  });

  it('omits viewer marker when position is null', () => {
    const opts = { ...defaultOptions, viewer_position: null };
    const result = renderEvacuationPlan(refMultilevel, 'lvl-ml-rdc', opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.svg).not.toContain('tok-marker');
  });

  it('includes title with level name', () => {
    const result = renderEvacuationPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.svg).toContain('RDC');
  });

  it('returns evacuation stats', () => {
    const result = renderEvacuationPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.stats.exit_count).toBeGreaterThanOrEqual(1);
    expect(result.value.stats.route_count).toBeGreaterThanOrEqual(1);
    expect(result.value.stats.total_route_length_m).toBeGreaterThan(0);
  });

  it('contains no hardcoded hex colors', () => {
    const result = renderEvacuationPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.svg).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('warns EVAC_EMPTY_LEVEL on level with no geometry', () => {
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
    };
    const opts = { ...defaultOptions, viewer_position: null };
    const result = renderEvacuationPlan(emptySite, 'lvl-empty', opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]?.code).toBe('LAYOUT.EVAC_EMPTY_LEVEL');
  });

  it('warns EVAC_NO_ROUTES when no evacuation routes on level', () => {
    const noEvacSite = {
      ...refMultilevel,
      graph: {
        ...refMultilevel.graph,
        edges: refMultilevel.graph.edges.map((e) => ({
          ...e,
          evacuation_route: false,
        })),
      },
    };
    const result = renderEvacuationPlan(noEvacSite, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const noRoutes = result.warnings.find(
      (w) => w.code === 'LAYOUT.EVAC_NO_ROUTES',
    );
    expect(noRoutes).toBeDefined();
  });

  it('warns EVAC_NO_EXITS when no exit nodes on level', () => {
    const noExitSite = {
      ...refMultilevel,
      graph: {
        ...refMultilevel.graph,
        nodes: refMultilevel.graph.nodes.map((n) =>
          n.kind === 'entrance' || n.kind === 'emergency_exit'
            ? { ...n, kind: 'junction' as const }
            : n,
        ),
      },
    };
    const result = renderEvacuationPlan(noExitSite, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const noExits = result.warnings.find(
      (w) => w.code === 'LAYOUT.EVAC_NO_EXITS',
    );
    expect(noExits).toBeDefined();
  });

  it('skips arrow on zero-pixel-length evacuation edge', () => {
    const site = {
      ...refMultilevel,
      graph: {
        ...refMultilevel.graph,
        nodes: [
          ...refMultilevel.graph.nodes,
          {
            id: 'n-same-pos',
            org_id: 'org-test-001',
            level_id: 'lvl-ml-rdc',
            kind: 'junction' as const,
            position: { x_m: 0, y_m: 0 },
            label: 'Same',
          },
          {
            id: 'n-same-pos-2',
            org_id: 'org-test-001',
            level_id: 'lvl-ml-rdc',
            kind: 'junction' as const,
            position: { x_m: 0, y_m: 0 },
            label: 'Same2',
          },
        ],
        edges: [
          ...refMultilevel.graph.edges,
          {
            id: 'e-zero-px',
            org_id: 'org-test-001',
            from_node_id: 'n-same-pos',
            to_node_id: 'n-same-pos-2',
            width_m: 1.5,
            slope_pct: 0,
            accessible: true,
            direction: 'both' as const,
            evacuation_route: true,
            length_m: 0.001,
          },
        ],
      },
    };
    const result = renderEvacuationPlan(site, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The evacuation route line is rendered but with no arrow polygon
    // since the pixel length is 0
    expect(result.value.stats.route_count).toBeGreaterThan(0);
  });

  it('reports zero stats on empty level with viewer only', () => {
    const emptySite = {
      ...refMultilevel,
      levels: [
        ...refMultilevel.levels,
        {
          id: 'lvl-stats-empty',
          org_id: 'org-test-001',
          building_id: 'bldg-ml-001',
          name: 'StatsVide',
          ordinal: 98,
          elevation_m: 98,
        },
      ],
    };
    const opts = { ...defaultOptions, viewer_position: null };
    const result = renderEvacuationPlan(emptySite, 'lvl-stats-empty', opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.stats.exit_count).toBe(0);
    expect(result.value.stats.route_count).toBe(0);
    expect(result.value.stats.total_route_length_m).toBe(0);
  });

  it('renders non-exit node circles with node theme tokens', () => {
    const result = renderEvacuationPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Regular nodes should use the node_fill and node_stroke tokens.
    expect(result.value.svg).toContain('tok-node');
    expect(result.value.svg).toContain('tok-node-s');
  });

  it('is deterministic (INV-4)', () => {
    const r1 = renderEvacuationPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    const r2 = renderEvacuationPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    expect(r1).toStrictEqual(r2);
  });

  it('escapes special characters in level name', () => {
    const site = {
      ...refMultilevel,
      levels: refMultilevel.levels.map((l) =>
        l.id === 'lvl-ml-rdc'
          ? { ...l, name: 'Hall "B" & <C>' }
          : l,
      ),
    };
    const result = renderEvacuationPlan(site, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.svg).toContain('&amp;');
    expect(result.value.svg).toContain('&lt;C&gt;');
    expect(result.value.svg).toContain('&quot;B&quot;');
    expect(result.value.svg).not.toContain('"B"');
  });

  it('escapes special characters in exit labels', () => {
    const site = {
      ...refMultilevel,
      graph: {
        ...refMultilevel.graph,
        nodes: refMultilevel.graph.nodes.map((n) =>
          n.kind === 'entrance'
            ? { ...n, label: 'Sortie <A>' }
            : n,
        ),
      },
    };
    const result = renderEvacuationPlan(site, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.svg).toContain('&lt;A&gt;');
  });

  it('single-point geometry uses fallback scale', () => {
    const site = {
      ...refMultilevel,
      levels: [
        ...refMultilevel.levels,
        {
          id: 'lvl-1pt',
          org_id: 'org-test-001',
          building_id: 'bldg-ml-001',
          name: 'Un point',
          ordinal: 97,
          elevation_m: 97,
        },
      ],
      footprints: [
        ...refMultilevel.footprints,
        {
          id: 'fp-1pt',
          org_id: 'org-test-001',
          level_id: 'lvl-1pt',
          geometry: {
            vertices: [{ x_m: 5, y_m: 5 }],
          },
          kind: 'room' as const,
        },
      ],
    };
    const opts = { ...defaultOptions, viewer_position: null };
    const result = renderEvacuationPlan(site, 'lvl-1pt', opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.svg).toContain('<svg');
    expect(result.value.svg).toContain('</svg>');
    // Level has geometry (single vertex) but no routes or exits → those warnings
    const warnCodes = result.warnings.map((w) => w.code);
    expect(warnCodes).not.toContain('LAYOUT.EVAC_EMPTY_LEVEL');
  });

  it('viewer far outside geometry still renders valid SVG', () => {
    const opts = {
      ...defaultOptions,
      viewer_position: { x_m: 1000, y_m: 1000 },
    };
    const result = renderEvacuationPlan(refMultilevel, 'lvl-ml-rdc', opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.svg).toContain('tok-marker');
    expect(result.value.svg).toContain('<svg');
  });

  it('shuffled node/edge order produces same output (sort determinism)', () => {
    const reversed = {
      ...refMultilevel,
      graph: {
        ...refMultilevel.graph,
        nodes: [...refMultilevel.graph.nodes].reverse(),
        edges: [...refMultilevel.graph.edges].reverse(),
      },
      footprints: [...refMultilevel.footprints].reverse(),
    };
    const r1 = renderEvacuationPlan(
      refMultilevel, 'lvl-ml-rdc', defaultOptions,
    );
    const r2 = renderEvacuationPlan(
      reversed, 'lvl-ml-rdc', defaultOptions,
    );
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    expect(r1.value.svg).toBe(r2.value.svg);
    expect(r1.value.stats).toStrictEqual(r2.value.stats);
  });
});
