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
import { computeRoute } from '@azimut/engine-graph';
import { computeInputsHash, computeContentHash } from '@azimut/engine-graph';
import {
  buildFileName,
  buildArchiveName,
  canonicalSerialize,
  sha256Hex,
} from '@azimut/core-model';
import type { FaceTemplate, TravelProfile } from '@azimut/core-model';

const RUNS = 5;

const floorTheme: FloorPlanTheme = {
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

const orientedOpts: OrientedPlanOptions = {
  width_px: 800,
  height_px: 600,
  theme: orientedTheme,
  font_family: 'Helvetica',
  show_destinations: true,
  show_edges: true,
  padding_px: 20,
  orientation_deg: 45,
  viewer_position: { x_m: 20, y_m: 10 },
  show_north_arrow: true,
};

const evacTheme: EvacuationTheme = {
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
  background: 'tok-bg',
  text_primary: 'tok-txt',
  text_secondary: 'tok-sec',
  accent: 'tok-acc',
  border: 'tok-brd',
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

describe('INV-4 — deterministic rendering', () => {
  it('renderFloorPlan produces identical output across runs', () => {
    const results = Array.from({ length: RUNS }, () =>
      renderFloorPlan(refMultilevel, 'lvl-ml-rdc', floorOpts),
    );
    for (const r of results) {
      expect(r.ok).toBe(true);
      if (!r.ok) return;
    }
    const first = results[0];
    if (!first?.ok) return;
    for (let i = 1; i < RUNS; i++) {
      const r = results[i];
      if (!r?.ok) return;
      expect(r.value).toBe(first.value);
    }
  });

  it('renderOrientedPlan produces identical output across runs', () => {
    const results = Array.from({ length: RUNS }, () =>
      renderOrientedPlan(refMultilevel, 'lvl-ml-rdc', orientedOpts),
    );
    for (const r of results) {
      expect(r.ok).toBe(true);
      if (!r.ok) return;
    }
    const first = results[0];
    if (!first?.ok) return;
    for (let i = 1; i < RUNS; i++) {
      const r = results[i];
      if (!r?.ok) return;
      expect(r.value).toBe(first.value);
    }
  });

  it('renderEvacuationPlan produces identical output across runs', () => {
    const results = Array.from({ length: RUNS }, () =>
      renderEvacuationPlan(refMultilevel, 'lvl-ml-rdc', evacOpts),
    );
    for (const r of results) {
      expect(r.ok).toBe(true);
      if (!r.ok) return;
    }
    const first = results[0];
    if (!first?.ok) return;
    for (let i = 1; i < RUNS; i++) {
      const r = results[i];
      if (!r?.ok) return;
      expect(r.value.svg).toBe(first.value.svg);
      expect(r.value.stats).toStrictEqual(first.value.stats);
    }
  });

  it('renderIsoView produces identical output across runs', () => {
    const levels = ['lvl-ml-rdc', 'lvl-ml-r1'];
    const results = Array.from({ length: RUNS }, () =>
      renderIsoView(refMultilevel, levels, isoOpts),
    );
    for (const r of results) {
      expect(r.ok).toBe(true);
      if (!r.ok) return;
    }
    const first = results[0];
    if (!first?.ok) return;
    for (let i = 1; i < RUNS; i++) {
      const r = results[i];
      if (!r?.ok) return;
      expect(r.value.svg).toBe(first.value.svg);
      expect(r.value.hitZones).toStrictEqual(first.value.hitZones);
    }
  });

  it('renderFace produces identical output across runs', () => {
    const template = getTemplate('ftpl-dir-front');
    const profile = getProfile('standard');
    const resolved = resolveFaceContent(
      refMultilevel, template, 'n-ml-hall', profile,
    );
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const results = Array.from({ length: RUNS }, () =>
      renderFace(resolved.value, faceOpts),
    );
    const first = results[0] as string;
    for (let i = 1; i < RUNS; i++) {
      expect(results[i]).toBe(first);
    }
  });

  it('computeRoute produces identical output across runs', () => {
    const results = Array.from({ length: RUNS }, () =>
      computeRoute(refMultilevel, getProfile('standard'), 'n-ml-hall', 'n-ml-dest-rdc'),
    );
    const first = results[0];
    for (let i = 1; i < RUNS; i++) {
      expect(results[i]).toStrictEqual(first);
    }
  });

  it('computeInputsHash produces identical output across runs', () => {
    const profile = getProfile('standard');
    const results = Array.from({ length: RUNS }, () =>
      computeInputsHash(refMultilevel, profile),
    );
    const first = results[0];
    for (let i = 1; i < RUNS; i++) {
      expect(results[i]).toBe(first);
    }
  });

  it('computeContentHash produces identical output across runs', () => {
    const template = getTemplate('ftpl-dir-front');
    const profile = getProfile('standard');
    const resolved = resolveFaceContent(
      refMultilevel, template, 'n-ml-hall', profile,
    );
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const results = Array.from({ length: RUNS }, () =>
      computeContentHash({
        resolved: resolved.value,
        template,
        charter_version: null,
        rules_pack_version: null,
        active_langs: ['fr', 'en'],
        dimensions: { width_mm: 600, height_mm: 400 },
      }),
    );
    const first = results[0];
    for (let i = 1; i < RUNS; i++) {
      expect(results[i]).toBe(first);
    }
  });

  it('buildFileName produces identical output across runs', () => {
    const parts = {
      site_code: 'Hôpital Saint-Léger',
      building: 'Bâtiment A',
      level: 'RDC',
      type_code: 'Directionnel',
      reference: 'DIR-001',
      version: 3,
      face: 'recto',
      extension: 'pdf',
    };
    const results = Array.from({ length: RUNS }, () => buildFileName(parts));
    const first = results[0];
    for (let i = 1; i < RUNS; i++) {
      expect(results[i]).toBe(first);
    }
  });

  it('buildArchiveName produces identical output across runs', () => {
    const parts = {
      site_code: 'Hôpital Saint-Léger',
      building: 'Bâtiment A',
      level: 'RDC',
      version: 1,
      extension: 'zip',
    };
    const results = Array.from({ length: RUNS }, () => buildArchiveName(parts));
    const first = results[0];
    for (let i = 1; i < RUNS; i++) {
      expect(results[i]).toBe(first);
    }
  });

  it('canonicalSerialize + sha256Hex produce identical output across runs', () => {
    const data = {
      z_key: 3,
      a_key: 'hello',
      m_key: [1, { nested: true, alpha: 'first' }],
    };
    const results = Array.from({ length: RUNS }, () =>
      sha256Hex(canonicalSerialize(data)),
    );
    const first = results[0];
    for (let i = 1; i < RUNS; i++) {
      expect(results[i]).toBe(first);
    }
  });
});
