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
    expect(result.findings[0]?.code).toBe('ORIENTED_PLAN.LEVEL_NOT_FOUND');
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

  it('is deterministic at 45° (INV-4)', () => {
    const opts = { ...defaultOptions, orientation_deg: 45 };
    const r1 = renderOrientedPlan(refMultilevel, 'lvl-ml-rdc', opts);
    const r2 = renderOrientedPlan(refMultilevel, 'lvl-ml-rdc', opts);
    expect(r1).toStrictEqual(r2);
  });
});
