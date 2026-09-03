import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit';
import { renderFloorPlan } from '@azimut/engine-layout';
import type { FloorPlanOptions, FloorPlanTheme } from '@azimut/engine-layout';
import { renderOrientedPlan } from '@azimut/engine-layout';
import type { OrientedPlanOptions, OrientedPlanTheme } from '@azimut/engine-layout';
import { renderEvacuationPlan } from '@azimut/engine-layout';
import type { EvacuationPlanOptions, EvacuationTheme } from '@azimut/engine-layout';
import { renderIsoView } from '@azimut/engine-iso';
import type { IsoOptions, IsoTheme, IsoMultiLevelMode } from '@azimut/engine-iso';
import { renderFace, resolveFaceContent } from '@azimut/engine-graph';
import type { FaceTheme, RenderFaceOptions } from '@azimut/engine-graph';
import type { FaceTemplate, TravelProfile } from '@azimut/core-model';

const floorTheme: FloorPlanTheme = {
  background: '#ffffff',
  footprint_fill: '#f0f0f0',
  footprint_stroke: '#cccccc',
  edge_stroke: '#999999',
  edge_evacuation_stroke: '#00aa00',
  node_fill: '#4488ff',
  node_stroke: '#2255bb',
  node_safety_fill: '#ff4444',
  text_primary: '#333333',
  text_secondary: '#666666',
};

const floorOpts: FloorPlanOptions = {
  width_px: 800,
  height_px: 600,
  theme: floorTheme,
  font_family: 'Helvetica',
  show_destinations: true,
  show_edges: true,
  padding_px: 20,
};

const orientedTheme: OrientedPlanTheme = {
  background: '#ffffff',
  footprint_fill: '#f0f0f0',
  footprint_stroke: '#cccccc',
  edge_stroke: '#999999',
  edge_evacuation_stroke: '#00aa00',
  node_fill: '#4488ff',
  node_stroke: '#2255bb',
  node_safety_fill: '#ff4444',
  text_primary: '#333333',
  text_secondary: '#666666',
  marker_fill: '#ff8800',
  marker_stroke: '#cc6600',
};

const orientedOpts: OrientedPlanOptions = {
  width_px: 800,
  height_px: 600,
  theme: orientedTheme,
  font_family: 'Helvetica',
  show_destinations: true,
  show_edges: true,
  padding_px: 20,
  orientation_deg: 0,
  viewer_position: { x_m: 20, y_m: 10 },
  show_north_arrow: true,
};

const evacTheme: EvacuationTheme = {
  background: '#ffffff',
  footprint_fill: '#f0f0f0',
  footprint_stroke: '#cccccc',
  route_stroke: '#00cc00',
  route_arrow: '#008800',
  non_route_stroke: '#dddddd',
  exit_fill: '#00ff00',
  exit_stroke: '#009900',
  assembly_fill: '#ffff00',
  assembly_stroke: '#cccc00',
  node_fill: '#4488ff',
  node_stroke: '#2255bb',
  text_primary: '#333333',
  text_secondary: '#666666',
  marker_fill: '#ff8800',
  marker_stroke: '#cc6600',
};

const evacOpts: EvacuationPlanOptions = {
  width_px: 800,
  height_px: 600,
  theme: evacTheme,
  font_family: 'Helvetica',
  padding_px: 20,
  viewer_position: { x_m: 20, y_m: 10 },
  show_non_evacuation: true,
};

const isoTheme: IsoTheme = {
  background: '#ffffff',
  floor_top: '#e8e8e8',
  floor_stroke: '#bbbbbb',
  wall_front: '#d0d0d0',
  wall_side: '#b8b8b8',
  wall_stroke: '#999999',
  node_fill: '#4488ff',
  node_stroke: '#2255bb',
  text_primary: '#333333',
};

const allMode: IsoMultiLevelMode = { kind: 'all' };

const isoOpts: IsoOptions = {
  width_px: 800,
  height_px: 600,
  theme: isoTheme,
  font_family: 'Helvetica',
  padding_px: 20,
  show_nodes: true,
  mode: allMode,
};

const faceTheme: FaceTheme = {
  background: '#ffffff',
  text_primary: '#333333',
  text_secondary: '#666666',
  accent: '#0066cc',
  border: '#cccccc',
};

const faceOpts: RenderFaceOptions = {
  width_mm: 600,
  height_mm: 400,
  theme: faceTheme,
  font_family: 'Helvetica',
};

function getProfile(key: string): TravelProfile {
  const p = refMultilevel.travel_profiles.find((pr) => pr.key === key);
  if (!p) throw new Error(`No profile: ${key}`);
  return p;
}

function getTemplate(id: string): FaceTemplate {
  const t = refMultilevel.face_templates.find((tpl) => tpl.id === id);
  if (!t) throw new Error(`No template: ${id}`);
  return t;
}

describe('Visual regression — floor plans', () => {
  it('RDC level snapshot', () => {
    const result = renderFloorPlan(refMultilevel, 'lvl-ml-rdc', floorOpts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchSnapshot();
  });

  it('R+1 level snapshot', () => {
    const result = renderFloorPlan(refMultilevel, 'lvl-ml-r1', floorOpts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchSnapshot();
  });

  it('without edges snapshot', () => {
    const opts = { ...floorOpts, show_edges: false };
    const result = renderFloorPlan(refMultilevel, 'lvl-ml-rdc', opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchSnapshot();
  });
});

describe('Visual regression — oriented plans', () => {
  it('0° orientation snapshot', () => {
    const result = renderOrientedPlan(refMultilevel, 'lvl-ml-rdc', orientedOpts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchSnapshot();
  });

  it('90° orientation snapshot', () => {
    const opts = { ...orientedOpts, orientation_deg: 90 };
    const result = renderOrientedPlan(refMultilevel, 'lvl-ml-rdc', opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchSnapshot();
  });

  it('180° orientation snapshot', () => {
    const opts = { ...orientedOpts, orientation_deg: 180 };
    const result = renderOrientedPlan(refMultilevel, 'lvl-ml-rdc', opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchSnapshot();
  });
});

describe('Visual regression — evacuation plans', () => {
  it('RDC evacuation snapshot', () => {
    const result = renderEvacuationPlan(refMultilevel, 'lvl-ml-rdc', evacOpts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.svg).toMatchSnapshot();
  });

  it('without non-evacuation edges snapshot', () => {
    const opts = { ...evacOpts, show_non_evacuation: false };
    const result = renderEvacuationPlan(refMultilevel, 'lvl-ml-rdc', opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.svg).toMatchSnapshot();
  });
});

describe('Visual regression — isometric views', () => {
  it('single level snapshot', () => {
    const result = renderIsoView(refMultilevel, ['lvl-ml-rdc'], isoOpts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.svg).toMatchSnapshot();
  });

  it('multi-level snapshot', () => {
    const result = renderIsoView(
      refMultilevel, ['lvl-ml-rdc', 'lvl-ml-r1'], isoOpts,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.svg).toMatchSnapshot();
  });

  it('exploded mode snapshot', () => {
    const opts: IsoOptions = {
      ...isoOpts,
      mode: { kind: 'exploded', offset_m: 4 },
    };
    const result = renderIsoView(
      refMultilevel, ['lvl-ml-rdc', 'lvl-ml-r1'], opts,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.svg).toMatchSnapshot();
  });
});

describe('Visual regression — face renders', () => {
  it('directional face snapshot', () => {
    const template = getTemplate('ftpl-dir-front');
    const profile = getProfile('standard');
    const resolved = resolveFaceContent(
      refMultilevel, template, 'n-ml-hall', profile,
    );
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const svg = renderFace(resolved.value, faceOpts);
    expect(svg).toMatchSnapshot();
  });
});
