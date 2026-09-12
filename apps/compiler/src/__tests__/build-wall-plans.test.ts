import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit';
import type { OrientedPlanTheme } from '@azimut/engine-layout';
import {
  buildWallPlanFamily,
  createBuildWallPlansHandler,
} from '../build-wall-plans.js';
import type { BuildWallPlansContext } from '../build-wall-plans.js';
import { memoryAssetStore } from '../asset-store.js';
import type { Job } from '../job.js';

const theme: OrientedPlanTheme = {
  background: 'tok-bg',
  footprint_fill: 'tok-fp',
  footprint_stroke: 'tok-fps',
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

const familyOpts = {
  theme,
  fontFamily: 'Helvetica',
  width_px: 800,
  height_px: 600,
  padding_px: 20,
  site_code: 'CPL',
  building: 'A',
  level: 'R1',
  version: 2,
};

const placements = [
  { node_id: 'n-ml-hall', level_id: 'lvl-ml-rdc', azimuth_deg: 0, reference: 'P-001', type_code: 'PLAN' },
  { node_id: 'n-ml-stair-rdc', level_id: 'lvl-ml-rdc', azimuth_deg: 90, reference: 'P-002', type_code: 'PLAN' },
];

function context(sink = memoryAssetStore()): BuildWallPlansContext {
  return {
    site: refMultilevel,
    theme,
    fontFamily: 'Helvetica',
    width_px: 800,
    height_px: 600,
    padding_px: 20,
    planSink: sink,
    storagePathFor: (s, b, l, v) => `plans/${s}_${b}_${l}_v${v}`,
  };
}

function makeJob(payload: Record<string, unknown>): Job {
  return {
    id: 'job-wp-1', org_id: 'org-test-001', kind: 'build_wall_plans',
    state: 'running', payload, result: null, attempts: 1, max_attempts: 3,
    created_at: new Date('2026-09-01T00:00:00Z'), started_at: null,
    finished_at: null, error: null,
  };
}

describe('D6.1 — buildWallPlanFamily', () => {
  it('produces one D11-named SVG per placement, oriented by azimuth', () => {
    const result = buildWallPlanFamily(refMultilevel, placements, familyOpts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect([...result.value.keys()].sort()).toEqual([
      'CPL_A_R1_PLAN_P-001_V2_PLAN.SVG',
      'CPL_A_R1_PLAN_P-002_V2_PLAN.SVG',
    ]);
    for (const svg of result.value.values()) expect(svg).toContain('<svg');
  });

  it('orients each plan differently by azimuth (family, not one file)', () => {
    // Same node, two different azimuths → different renders.
    const two = [
      { node_id: 'n-ml-hall', level_id: 'lvl-ml-rdc', azimuth_deg: 0, reference: 'P-001', type_code: 'PLAN' },
      { node_id: 'n-ml-hall', level_id: 'lvl-ml-rdc', azimuth_deg: 90, reference: 'P-002', type_code: 'PLAN' },
    ];
    const result = buildWallPlanFamily(refMultilevel, two, familyOpts);
    if (!result.ok) throw new Error('expected ok');
    const svgs = [...result.value.values()];
    expect(svgs[0]).not.toBe(svgs[1]);
  });

  it('is deterministic', () => {
    const a = buildWallPlanFamily(refMultilevel, placements, familyOpts);
    const b = buildWallPlanFamily(refMultilevel, placements, familyOpts);
    if (!a.ok || !b.ok) throw new Error('expected ok');
    expect([...a.value]).toEqual([...b.value]);
  });

  it('rejects a name collision with PACKAGE.DUPLICATE_PATH', () => {
    // Same reference+type on two nodes → same D11 name.
    const dup = [
      { node_id: 'n-ml-hall', level_id: 'lvl-ml-rdc', azimuth_deg: 0, reference: 'P-001', type_code: 'PLAN' },
      { node_id: 'n-ml-stair-rdc', level_id: 'lvl-ml-rdc', azimuth_deg: 0, reference: 'P-001', type_code: 'PLAN' },
    ];
    const result = buildWallPlanFamily(refMultilevel, dup, familyOpts);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.some((f) => f.code === 'PACKAGE.DUPLICATE_PATH')).toBe(true);
  });

  it('throws when a placement node does not exist', () => {
    const bad = [
      { node_id: 'n-nope', level_id: 'lvl-ml-rdc', azimuth_deg: 0, reference: 'P-001', type_code: 'PLAN' },
    ];
    expect(() => buildWallPlanFamily(refMultilevel, bad, familyOpts)).toThrow('node not found');
  });
});

describe('D6.1 — createBuildWallPlansHandler', () => {
  it('writes the plan family to storage', async () => {
    const sink = memoryAssetStore();
    const result = await createBuildWallPlansHandler(context(sink))(
      makeJob({ site_code: 'CPL', building: 'A', level: 'R1', version: 2, placements }),
    );
    expect(result['file_count']).toBe(2);
    expect(result['total_bytes']).toBeGreaterThan(0);
    expect(result['storage_path']).toBe('plans/CPL_A_R1_v2');
    await expect(sink.read('plans/CPL_A_R1_v2/CPL_A_R1_PLAN_P-001_V2_PLAN.SVG')).resolves.toBeDefined();
  });

  it('rejects an empty placement list', async () => {
    await expect(
      createBuildWallPlansHandler(context())(makeJob({
        site_code: 'CPL', building: 'A', level: 'R1', version: 2, placements: [],
      })),
    ).rejects.toThrow('no placements');
  });

  it('rejects a payload missing the version', async () => {
    await expect(
      createBuildWallPlansHandler(context())(makeJob({
        site_code: 'CPL', building: 'A', level: 'R1', placements,
      })),
    ).rejects.toThrow('version');
  });
});
