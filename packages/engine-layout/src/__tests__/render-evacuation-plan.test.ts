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

  it('is deterministic (INV-4)', () => {
    const r1 = renderEvacuationPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    const r2 = renderEvacuationPlan(refMultilevel, 'lvl-ml-rdc', defaultOptions);
    expect(r1).toStrictEqual(r2);
  });
});
