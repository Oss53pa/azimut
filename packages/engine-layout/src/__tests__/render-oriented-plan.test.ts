import { describe, it, expect } from 'vitest';
import { renderOrientedPlan } from '../render-oriented-plan.js';
import type { OrientedPlanOptions, OrientedPlanTheme } from '../render-oriented-plan.js';
import { refMultilevel } from '@azimut/testkit';

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
});
