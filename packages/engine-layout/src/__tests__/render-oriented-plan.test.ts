import { describe, it, expect } from 'vitest';
import { renderOrientedPlan } from '../render-oriented-plan.js';
import type { OrientedPlanOptions, OrientedPlanTheme } from '../render-oriented-plan.js';
import { refMultilevel } from '@azimut/testkit';
import type { GraphNode, Destination } from '@azimut/core-model';

const theme: OrientedPlanTheme = {
  background: 'tok-bg',
  footprint_fill: 'tok-fp-fill',
  footprint_stroke: 'tok-fp-stroke',
  edge_stroke: 'tok-edge',
  edge_evacuation_stroke: 'tok-evac',
  node_fill: 'tok-node',
  node_stroke: 'tok-node-s',
  node_safety_fill: 'tok-safety',
  text_primary: 'tok-txt',
  text_secondary: 'tok-txt2',
  marker_fill: 'tok-marker',
  marker_stroke: 'tok-marker-s',
};

const defaultOptions: OrientedPlanOptions = {
  width_px: 800,
  height_px: 600,
  theme,
  font_family: 'Helvetica',
  show_destinations: true,
  show_edges: true,
  padding_px: 20,
  orientation_deg: 0,
  viewer_position: { x_m: 20, y_m: 10 },
  show_north_arrow: true,
};

describe('T-2.9 renderOrientedPlan', () => {
  it('returns error for unknown level', () => {
    const result = renderOrientedPlan(refMultilevel, 'nonexistent', defaultOptions);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('LAYOUT.ORIENTED_PLAN_LEVEL_NOT_FOUND');
  });

  it('renders valid SVG at 0°', () => {
    const result = renderOrientedPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('<svg');
    expect(result.value).toContain('</svg>');
  });

  it('renders valid SVG at 90°', () => {
    const opts = { ...defaultOptions, orientation_deg: 90 };
    const result = renderOrientedPlan(refMultilevel, 'lvl-ml-rdc', opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('<svg');
  });

  it('renders valid SVG at 180°', () => {
    const opts = { ...defaultOptions, orientation_deg: 180 };
    const result = renderOrientedPlan(refMultilevel, 'lvl-ml-rdc', opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('<svg');
  });

  it('produces different output for different orientations', () => {
    const r0 = renderOrientedPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    const r90 = renderOrientedPlan(
      refMultilevel,
      'lvl-ml-rdc',
      { ...defaultOptions, orientation_deg: 90 },
    );
    expect(r0.ok).toBe(true);
    expect(r90.ok).toBe(true);
    if (!r0.ok || !r90.ok) return;
    expect(r0.value).not.toBe(r90.value);
  });

  it('includes you-are-here marker', () => {
    const result = renderOrientedPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('tok-marker');
    expect(result.value).toContain('tok-marker-s');
  });

  it('includes north arrow when enabled', () => {
    const result = renderOrientedPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('>N</text>');
  });

  it('hides north arrow when disabled', () => {
    const opts = { ...defaultOptions, show_north_arrow: false };
    const result = renderOrientedPlan(refMultilevel, 'lvl-ml-rdc', opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toContain('>N</text>');
  });

  it('includes footprints', () => {
    const result = renderOrientedPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('<polygon');
    expect(result.value).toContain('tok-fp-fill');
  });

  it('includes destination labels', () => {
    const result = renderOrientedPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('Bureau RDC');
  });

  it('contains no hardcoded hex colors', () => {
    const result = renderOrientedPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('is deterministic (INV-4)', () => {
    const r1 = renderOrientedPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    const r2 = renderOrientedPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    expect(r1).toStrictEqual(r2);
  });

  it('360° rotation produces same output as 0°', () => {
    const r0 = renderOrientedPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    const r360 = renderOrientedPlan(refMultilevel, 'lvl-ml-rdc', {
      ...defaultOptions,
      orientation_deg: 360,
    });
    expect(r0).toStrictEqual(r360);
  });

  it('renders minimal SVG with edges and destinations hidden', () => {
    const opts = {
      ...defaultOptions,
      show_edges: false,
      show_destinations: false,
      show_north_arrow: false,
    };
    const result = renderOrientedPlan(refMultilevel, 'lvl-ml-rdc', opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toContain('<line');
    expect(result.value).not.toContain('Bureau RDC');
    expect(result.value).not.toContain('>N</text>');
    // But still has viewer marker and nodes
    expect(result.value).toContain('tok-marker');
    expect(result.value).toContain('<circle');
  });

  it('is deterministic at 45° (INV-4)', () => {
    const opts = { ...defaultOptions, orientation_deg: 45 };
    const r1 = renderOrientedPlan(refMultilevel, 'lvl-ml-rdc', opts);
    const r2 = renderOrientedPlan(refMultilevel, 'lvl-ml-rdc', opts);
    expect(r1).toStrictEqual(r2);
  });
});

describe('D6.4 — decisive test: front destination in upper half', () => {
  it('north-facing support: destination to the north appears in upper half', () => {
    const viewerPos = { x_m: 20, y_m: 10 };
    const opts: OrientedPlanOptions = {
      ...defaultOptions,
      orientation_deg: 0,
      viewer_position: viewerPos,
    };
    const result = renderOrientedPlan(refMultilevel, 'lvl-ml-rdc', opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const destMatch = result.value.match(
      /Bureau RDC<\/text>/,
    );
    expect(destMatch).not.toBeNull();

    const yMatch = result.value.match(
      /<text[^>]* y="([^"]+)"[^>]*>Bureau RDC<\/text>/,
    );
    expect(yMatch).not.toBeNull();
    const destY = parseFloat(yMatch?.[1] ?? 'NaN');
    const midY = defaultOptions.height_px / 2;
    expect(destY).toBeLessThan(midY);
  });

  it('east-facing support: destination to the east appears in upper half', () => {
    const viewerPos = { x_m: 20, y_m: 10 };
    const opts: OrientedPlanOptions = {
      ...defaultOptions,
      orientation_deg: -90,
      viewer_position: viewerPos,
    };
    const result = renderOrientedPlan(refMultilevel, 'lvl-ml-rdc', opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const stairNode = refMultilevel.graph.nodes.find(
      (n) => n.id === 'n-ml-stair-rdc',
    );
    expect(stairNode).toBeDefined();

    const yMatch = result.value.match(
      /<circle[^>]*cx="[^"]*"[^>]*cy="([^"]+)"[^>]*fill="tok-node"/,
    );
    expect(yMatch).not.toBeNull();
  });

  it('level with no destinations omits destination labels', () => {
    // Remove all destinations so show_destinations finds nothing to render
    const site = { ...refMultilevel, destinations: [] };
    const result = renderOrientedPlan(site, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('<svg');
    expect(result.value).not.toContain('tok-txt2');
  });

  it('evacuation edges use evacuation stroke and dash', () => {
    const result = renderOrientedPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // refMultilevel has evacuation_route: true edges on RDC level
    expect(result.value).toContain('tok-evac');
    expect(result.value).toContain('stroke-dasharray="6 3"');
    // Also has non-evacuation edges
    expect(result.value).toContain('tok-edge');
  });

  it('safety-kind node uses node_safety_fill', () => {
    // Patch refMultilevel to add an emergency_exit node on RDC
    const safetyNode = {
      id: 'n-ml-exit-rdc',
      org_id: 'org-test-001',
      level_id: 'lvl-ml-rdc',
      kind: 'emergency_exit' as const,
      position: { x_m: 25, y_m: 15 },
      label: 'Sortie secours',
    };
    const site = {
      ...refMultilevel,
      graph: {
        ...refMultilevel.graph,
        nodes: [...refMultilevel.graph.nodes, safetyNode],
      },
    };
    const result = renderOrientedPlan(site, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('tok-safety');
  });

  it('single-point geometry uses fallback scale of 1', () => {
    // Level with zero footprints and zero nodes — only the viewer marker
    const site = {
      ...refMultilevel,
      footprints: [],
      graph: { ...refMultilevel.graph, nodes: [], edges: [] },
      destinations: [],
    };
    const result = renderOrientedPlan(site, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // SVG should render with the viewer marker only
    expect(result.value).toContain('tok-marker');
    expect(result.value).toContain('<circle');
  });

  it('node radius differs by kind (entrance > junction)', () => {
    const mkNode = (id: string, kind: GraphNode['kind']): GraphNode => ({
      id, org_id: 'org-test-001', level_id: 'lvl-ml-rdc',
      kind, label: id, position: { x_m: 10 + Math.random() * 5, y_m: 10 },
    });
    const site = {
      ...refMultilevel,
      graph: {
        ...refMultilevel.graph,
        nodes: [mkNode('n-ent', 'entrance'), mkNode('n-junc', 'junction')],
        edges: [],
      },
      footprints: refMultilevel.footprints.filter((f) => f.level_id === 'lvl-ml-rdc'),
      destinations: [],
    };
    const result = renderOrientedPlan(site, 'lvl-ml-rdc', {
      ...defaultOptions, show_destinations: false, show_edges: false,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // entrance → r=6, junction → r=3
    expect(result.value).toContain('r="6"');
    expect(result.value).toContain('r="3"');
  });

  it.each([
    ['stair', '5'],
    ['elevator', '5'],
    ['escalator', '5'],
    ['security_post', '5'],
    ['destination_access', '4'],
  ] as const)('nodeRadius for %s renders r="%s"', (kind, expectedR) => {
    const node: GraphNode = {
      id: 'n-test', org_id: 'org-test-001', level_id: 'lvl-ml-rdc',
      kind, label: 'test', position: { x_m: 15, y_m: 12 },
    };
    const site = {
      ...refMultilevel,
      graph: { ...refMultilevel.graph, nodes: [node], edges: [] },
      footprints: refMultilevel.footprints.filter((f) => f.level_id === 'lvl-ml-rdc'),
      destinations: [],
    };
    const result = renderOrientedPlan(site, 'lvl-ml-rdc', {
      ...defaultOptions, show_destinations: false, show_edges: false,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain(`r="${expectedR}"`);
  });

  it('escapes HTML entities in occupant_name', () => {
    const node: GraphNode = {
      id: 'n-esc', org_id: 'org-test-001', level_id: 'lvl-ml-rdc',
      kind: 'destination_access', label: 'esc', position: { x_m: 15, y_m: 12 },
    };
    const dest: Destination = {
      id: 'dest-esc', org_id: 'org-test-001', footprint_id: 'fp-1',
      node_id: 'n-esc', category_id: 'cat-1', occupant_name: 'A & B <Corp>',
      occupancy_status: 'occupied', display_priority: 5,
    };
    const site = {
      ...refMultilevel,
      graph: { ...refMultilevel.graph, nodes: [...refMultilevel.graph.nodes, node], edges: [] },
      destinations: [dest],
    };
    const result = renderOrientedPlan(site, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('A &amp; B &lt;Corp&gt;');
    expect(result.value).not.toContain('A & B <Corp>');
  });

  it('destination sort tiebreaker uses id when priorities match', () => {
    const nodeA = {
      id: 'n-tie-a', org_id: 'org-test-001', level_id: 'lvl-ml-rdc',
      kind: 'destination_access' as const, label: 'A', position: { x_m: 15, y_m: 12 },
    };
    const nodeB = {
      id: 'n-tie-b', org_id: 'org-test-001', level_id: 'lvl-ml-rdc',
      kind: 'destination_access' as const, label: 'B', position: { x_m: 25, y_m: 12 },
    };
    const mkDest = (id: string, nodeId: string, name: string): Destination => ({
      id, org_id: 'org-test-001', footprint_id: 'fp-1', node_id: nodeId,
      category_id: 'cat-1', occupant_name: name, occupancy_status: 'occupied', display_priority: 5,
    });
    const site = {
      ...refMultilevel,
      graph: { ...refMultilevel.graph, nodes: [...refMultilevel.graph.nodes, nodeA, nodeB], edges: [] },
      destinations: [mkDest('dest-z', 'n-tie-b', 'Zeta'), mkDest('dest-a', 'n-tie-a', 'Alpha')],
    };
    const result = renderOrientedPlan(site, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const idxA = result.value.indexOf('Alpha');
    const idxZ = result.value.indexOf('Zeta');
    expect(idxA).toBeGreaterThan(-1);
    expect(idxZ).toBeGreaterThan(-1);
    // dest-a (id < dest-z) comes first in SVG output
    expect(idxA).toBeLessThan(idxZ);
  });
});
