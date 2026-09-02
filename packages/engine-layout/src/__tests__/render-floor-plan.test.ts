import { describe, it, expect } from 'vitest';
import { renderFloorPlan } from '../render-floor-plan.js';
import type { FloorPlanOptions, FloorPlanTheme } from '../render-floor-plan.js';
import { refMultilevel } from '@azimut/testkit';

const theme: FloorPlanTheme = {
  background: 'tok-bg',
  footprint_fill: 'tok-fp-fill',
  footprint_stroke: 'tok-fp-stroke',
  edge_stroke: 'tok-edge',
  edge_evacuation_stroke: 'tok-evac',
  node_fill: 'tok-node',
  node_stroke: 'tok-node-stroke',
  node_safety_fill: 'tok-safety',
  text_primary: 'tok-txt',
  text_secondary: 'tok-txt2',
};

const defaultOptions: FloorPlanOptions = {
  width_px: 800,
  height_px: 600,
  theme,
  font_family: 'Helvetica',
  show_destinations: true,
  show_edges: true,
  padding_px: 20,
};

describe('T-2.8 renderFloorPlan', () => {
  it('returns error for unknown level', () => {
    const result = renderFloorPlan(refMultilevel, 'nonexistent', defaultOptions);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('LAYOUT.FLOOR_PLAN_LEVEL_NOT_FOUND');
  });

  it('renders RDC level as valid SVG', () => {
    const result = renderFloorPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('<svg');
    expect(result.value).toContain('</svg>');
  });

  it('renders R+1 level as valid SVG', () => {
    const result = renderFloorPlan(refMultilevel, 'lvl-ml-r1', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('<svg');
  });

  it('includes footprint polygons', () => {
    const result = renderFloorPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('<polygon');
    expect(result.value).toContain('tok-fp-fill');
    expect(result.value).toContain('tok-fp-stroke');
  });

  it('includes node circles', () => {
    const result = renderFloorPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('<circle');
    expect(result.value).toContain('tok-node');
  });

  it('includes edges as lines', () => {
    const result = renderFloorPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('<line');
    expect(result.value).toContain('tok-edge');
  });

  it('uses evacuation stroke for evacuation edges', () => {
    const result = renderFloorPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('tok-evac');
    expect(result.value).toContain('stroke-dasharray');
  });

  it('includes destination labels', () => {
    const result = renderFloorPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('Bureau RDC');
  });

  it('hides edges when show_edges is false', () => {
    const opts = { ...defaultOptions, show_edges: false };
    const result = renderFloorPlan(refMultilevel, 'lvl-ml-rdc', opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toContain('<line');
  });

  it('hides destinations when show_destinations is false', () => {
    const opts = { ...defaultOptions, show_destinations: false };
    const result = renderFloorPlan(refMultilevel, 'lvl-ml-rdc', opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toContain('Bureau RDC');
  });

  it('contains no hardcoded hex colors', () => {
    const result = renderFloorPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('is deterministic (INV-4)', () => {
    const r1 = renderFloorPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    const r2 = renderFloorPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    expect(r1).toStrictEqual(r2);
  });

  it('warns on empty level', () => {
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
    const result = renderFloorPlan(emptySite, 'lvl-empty', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]?.code).toBe('LAYOUT.FLOOR_PLAN_EMPTY_LEVEL');
    expect(result.value).toContain('aucun');
  });

  it('filters cross-level edges out', () => {
    const result = renderFloorPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const lineCount = (result.value.match(/<line /g) ?? []).length;
    const rdcEdges = refMultilevel.graph.edges.filter((e) => {
      const rdcNodeIds = new Set(
        refMultilevel.graph.nodes
          .filter((n) => n.level_id === 'lvl-ml-rdc')
          .map((n) => n.id),
      );
      return rdcNodeIds.has(e.from_node_id) && rdcNodeIds.has(e.to_node_id);
    });
    expect(lineCount).toBe(rdcEdges.length);
  });
});
