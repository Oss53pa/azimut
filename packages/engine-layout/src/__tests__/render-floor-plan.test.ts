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

  it('escapes special characters in destination names', () => {
    const site = {
      ...refMultilevel,
      destinations: refMultilevel.destinations.map((d) =>
        d.id === 'dest-ml-rdc'
          ? { ...d, occupant_name: 'Salle <A> & "B"' }
          : d,
      ),
    };
    const result = renderFloorPlan(site, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('&amp;');
    expect(result.value).toContain('&lt;A&gt;');
    expect(result.value).toContain('&quot;B&quot;');
    expect(result.value).not.toContain('<A>');
  });

  it('escapes double quotes in theme values', () => {
    const xssTheme: FloorPlanTheme = {
      ...theme,
      background: 'color"injected',
    };
    const opts = { ...defaultOptions, theme: xssTheme };
    const result = renderFloorPlan(refMultilevel, 'lvl-ml-rdc', opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('color&quot;injected');
    expect(result.value).not.toContain('color"injected');
  });

  it('escapes font family', () => {
    const opts = { ...defaultOptions, font_family: '"Helvetica Neue" & Co' };
    const result = renderFloorPlan(refMultilevel, 'lvl-ml-rdc', opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('&amp;');
    expect(result.value).not.toContain('" & Co');
  });

  it('renders entrance node with larger radius than junction', () => {
    const result = renderFloorPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Extract all circle r= values
    const radii = [...result.value.matchAll(/<circle[^>]+r="(\d+)"/g)].map(
      (m) => parseInt(m[1] ?? '0', 10),
    );
    // Entrance radius is 6, junction is 3. Both should be present.
    expect(radii).toContain(6);
    expect(radii).toContain(3);
  });

  it('renders escalator node with radius 5', () => {
    const site = {
      ...refMultilevel,
      graph: {
        ...refMultilevel.graph,
        nodes: [
          ...refMultilevel.graph.nodes,
          {
            id: 'n-escalator-test',
            org_id: 'org-test-001',
            level_id: 'lvl-ml-rdc',
            kind: 'escalator' as const,
            position: { x_m: 10, y_m: 10 },
            label: 'Escalier mécanique',
          },
        ],
      },
    };
    const result = renderFloorPlan(site, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Escalator radius is 5
    const radii = [...result.value.matchAll(/<circle[^>]+r="(\d+)"/g)].map(
      (m) => parseInt(m[1] ?? '0', 10),
    );
    expect(radii).toContain(5);
  });

  it('renders safety node with safety fill color', () => {
    const site = {
      ...refMultilevel,
      graph: {
        ...refMultilevel.graph,
        nodes: [
          ...refMultilevel.graph.nodes,
          {
            id: 'n-emergency-test',
            org_id: 'org-test-001',
            level_id: 'lvl-ml-rdc',
            kind: 'emergency_exit' as const,
            position: { x_m: 15, y_m: 15 },
            label: 'Sortie secours',
          },
        ],
      },
    };
    const result = renderFloorPlan(site, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('tok-safety');
  });

  it('renders destination_access node with radius 4', () => {
    const result = renderFloorPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const radii = [...result.value.matchAll(/<circle[^>]+r="(\d+)"/g)].map(
      (m) => parseInt(m[1] ?? '0', 10),
    );
    expect(radii).toContain(4);
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

  it('security_post node uses safety fill color', () => {
    const site = {
      ...refMultilevel,
      graph: {
        ...refMultilevel.graph,
        nodes: [
          ...refMultilevel.graph.nodes,
          {
            id: 'n-secpost',
            org_id: 'org-test-001',
            level_id: 'lvl-ml-rdc',
            kind: 'security_post' as const,
            position: { x_m: 15, y_m: 5 },
            label: 'Poste sécurité',
          },
        ],
      },
    };
    const result = renderFloorPlan(site, 'lvl-ml-rdc', defaultOptions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // security_post is a SAFETY_KINDS member → gets tok-safety fill and radius 5
    expect(result.value).toContain('tok-safety');
    const circles = [...result.value.matchAll(/<circle[^>]+r="5"/g)];
    expect(circles.length).toBeGreaterThanOrEqual(1);
  });

  it('destination sort tiebreaks on id when display_priority is equal', () => {
    const site = {
      ...refMultilevel,
      destinations: [
        ...refMultilevel.destinations,
        {
          id: 'dest-tie-beta',
          org_id: 'org-test-001',
          footprint_id: 'fp-ml-hall',
          node_id: 'n-ml-hall',
          category_id: 'cat-ml-office',
          occupant_name: 'Beta',
          occupancy_status: 'occupied' as const,
          display_priority: 1,
        },
        {
          id: 'dest-tie-alpha',
          org_id: 'org-test-001',
          footprint_id: 'fp-ml-hall',
          node_id: 'n-ml-hall',
          category_id: 'cat-ml-office',
          occupant_name: 'Alpha',
          occupancy_status: 'occupied' as const,
          display_priority: 1,
        },
      ],
      destination_names: [
        ...refMultilevel.destination_names,
        { id: 'dn-tie-beta', org_id: 'org-test-001', destination_id: 'dest-tie-beta', lang: 'fr' as const, value: 'Beta' },
        { id: 'dn-tie-alpha', org_id: 'org-test-001', destination_id: 'dest-tie-alpha', lang: 'fr' as const, value: 'Alpha' },
      ],
    };
    const r1 = renderFloorPlan(site, 'lvl-ml-rdc', defaultOptions);
    const r2 = renderFloorPlan(site, 'lvl-ml-rdc', defaultOptions);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    expect(r1.value).toBe(r2.value);
    // alpha should appear before beta in the SVG (id sort)
    const alphaIdx = r1.value.indexOf('Alpha');
    const betaIdx = r1.value.indexOf('Beta');
    expect(alphaIdx).toBeGreaterThan(0);
    expect(betaIdx).toBeGreaterThan(0);
    expect(alphaIdx).toBeLessThan(betaIdx);
  });

  it('handles collinear nodes (zero-extent x) without crashing', () => {
    const site = {
      ...refMultilevel,
      levels: [
        ...refMultilevel.levels,
        {
          id: 'lvl-col',
          org_id: 'org-test-001',
          building_id: 'bldg-ml-001',
          name: 'Collinear',
          ordinal: 50,
          elevation_m: 0,
        },
      ],
      graph: {
        ...refMultilevel.graph,
        nodes: [
          ...refMultilevel.graph.nodes,
          { id: 'n-col-a', org_id: 'org-test-001', level_id: 'lvl-col', kind: 'junction' as const, position: { x_m: 5, y_m: 0 }, label: 'A' },
          { id: 'n-col-b', org_id: 'org-test-001', level_id: 'lvl-col', kind: 'junction' as const, position: { x_m: 5, y_m: 10 }, label: 'B' },
        ],
      },
    };
    const opts = { ...defaultOptions, show_destinations: false, show_edges: false };
    const result = renderFloorPlan(site, 'lvl-col', opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('<svg');
  });

  it('handles horizontal collinear nodes (zero-extent y) without crashing', () => {
    const lvl = { id: 'lvl-hor', org_id: 'org-test-001', building_id: 'bld-ml', name: 'H', ordinal: 99, elevation_m: 99 };
    const fp = { id: 'fp-hor', org_id: 'org-test-001', level_id: 'lvl-hor',
      geometry: { vertices: [{ x_m: 0, y_m: 5 }, { x_m: 20, y_m: 5 }, { x_m: 20, y_m: 5 }, { x_m: 0, y_m: 5 }] }, kind: 'room' as const };
    const site = { ...refMultilevel, levels: [...refMultilevel.levels, lvl], footprints: [...refMultilevel.footprints, fp],
      graph: { ...refMultilevel.graph, nodes: [...refMultilevel.graph.nodes,
        { id: 'n-h-a', org_id: 'org-test-001', level_id: 'lvl-hor', kind: 'junction' as const, position: { x_m: 0, y_m: 5 }, label: 'A' },
        { id: 'n-h-b', org_id: 'org-test-001', level_id: 'lvl-hor', kind: 'junction' as const, position: { x_m: 10, y_m: 5 }, label: 'B' }] } };
    const result = renderFloorPlan(site, 'lvl-hor', { ...defaultOptions, show_destinations: false, show_edges: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('<svg');
  });

  it('zero extent in both X and Y (single-point geometry)', () => {
    const lvl = { id: 'lvl-pt', org_id: 'org-test-001', building_id: 'bldg-ml-001', name: 'Point', ordinal: 99, elevation_m: 0 };
    const site = { ...refMultilevel, levels: [...refMultilevel.levels, lvl],
      graph: { ...refMultilevel.graph, nodes: [...refMultilevel.graph.nodes,
        { id: 'n-pt', org_id: 'org-test-001', level_id: 'lvl-pt', kind: 'junction' as const, position: { x_m: 5, y_m: 5 }, label: 'Pt' }] } };
    const result = renderFloorPlan(site, 'lvl-pt', { ...defaultOptions, show_destinations: false, show_edges: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('<circle');
  });
});
