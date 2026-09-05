import { describe, it, expect } from 'vitest';
import { validateGeometry } from '../validate-geometry.js';
import { refMinimal, refAdversarial } from '@azimut/testkit';
import type { SiteData, Footprint, Volume } from '@azimut/core-model';

/** Build a minimal SiteData with the given footprints and volumes. */
function siteWith(
  footprints: readonly Footprint[],
  volumes: readonly Volume[] = [],
): SiteData {
  return {
    organization: { id: 'org1', name: 'T', slug: 't' },
    site: { id: 's1', org_id: 'org1', name: 'S', country_code: 'FR', rules_pack_id: null },
    buildings: [{ id: 'b1', org_id: 'org1', site_id: 's1', name: 'B', independent_access: true }],
    levels: [{ id: 'l1', org_id: 'org1', building_id: 'b1', name: 'RDC', ordinal: 0, elevation_m: 0 }],
    footprints,
    volumes,
    graph: { nodes: [], edges: [], vertical_links: [] },
    categories: [],
    pictograms: [],
    destinations: [],
    destination_names: [],
    travel_profiles: [],
    support_types: [],
    face_templates: [],
  };
}

function fp(id: string, verts: [number, number][], level = 'l1'): Footprint {
  return {
    id, org_id: 'org1', level_id: level,
    geometry: { vertices: verts.map(([x, y]) => ({ x_m: x, y_m: y })) },
    kind: 'room',
  };
}
const GOOD_FP = fp('fp-good', [[0, 0], [10, 0], [10, 10], [0, 10]]);

describe('validateGeometry', () => {
  it('passes for valid footprints and volumes', () => {
    const vol: Volume = {
      id: 'v1', org_id: 'org1', footprint_id: 'fp-good',
      base_elevation_m: 0, height_m: 3, material_key: 'concrete',
    };
    const result = validateGeometry(siteWith([GOOD_FP], [vol]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.valid_footprints).toBe(1);
    expect(result.value.valid_volumes).toBe(1);
  });

  it('detects polygon with too few vertices', () => {
    const result = validateGeometry(siteWith([fp('fp-2v', [[0, 0], [5, 5]])]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.some((f) => f.code === 'GEOM.POLYGON_TOO_FEW_VERTICES')).toBe(true);
  });

  it('detects polygon with coincident first and last vertex', () => {
    const result = validateGeometry(siteWith([
      fp('fp-dup', [[0, 0], [10, 0], [10, 10], [0, 0.0005]]),
    ]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.some((f) => f.code === 'GEOM.POLYGON_NOT_CLOSED')).toBe(true);
  });

  it('does not flag polygon with distant first/last vertex', () => {
    // First and last vertices are 10m apart — not coincident.
    const result = validateGeometry(siteWith([GOOD_FP]));
    expect(result.ok).toBe(true);
  });

  it('detects degenerate polygon (area below tolerance)', () => {
    const result = validateGeometry(refAdversarial);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.some((f) =>
      f.code === 'GEOM.POLYGON_DEGENERATE' && f.entity?.id === 'fp-adv-triangle',
    )).toBe(true);
  });

  it('detects self-intersecting polygon (bowtie)', () => {
    const result = validateGeometry(siteWith([
      fp('fp-bowtie', [[0, 0], [10, 10], [10, 0], [0, 10]]),
    ]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.some((f) => f.code === 'GEOM.POLYGON_SELF_INTERSECTING')).toBe(true);
  });

  it('does not flag a convex polygon as self-intersecting', () => {
    const result = validateGeometry(siteWith([GOOD_FP]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.some((f) => f.code === 'GEOM.POLYGON_SELF_INTERSECTING')).toBe(false);
  });

  it('detects volume with zero height', () => {
    const vol: Volume = {
      id: 'v-zero', org_id: 'org1', footprint_id: 'fp-good',
      base_elevation_m: 0, height_m: 0, material_key: 'glass',
    };
    const result = validateGeometry(siteWith([GOOD_FP], [vol]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.some((f) => f.code === 'GEOM.VOLUME_NO_HEIGHT')).toBe(true);
  });

  it('detects volume with negative height', () => {
    const vol: Volume = {
      id: 'v-neg', org_id: 'org1', footprint_id: 'fp-good',
      base_elevation_m: 0, height_m: -2, material_key: 'glass',
    };
    const result = validateGeometry(siteWith([GOOD_FP], [vol]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.some((f) =>
      f.code === 'GEOM.VOLUME_NO_HEIGHT' && f.entity?.id === 'v-neg',
    )).toBe(true);
  });

  it('detects overlapping footprints on same level', () => {
    const result = validateGeometry(siteWith([
      fp('fp-a', [[0, 0], [10, 0], [10, 10], [0, 10]]),
      fp('fp-b', [[5, 5], [15, 5], [15, 15], [5, 15]]),
    ]));
    expect(result.ok).toBe(true); // overlap is a warning, not blocking
    if (!result.ok) return;
    expect(result.warnings.some((f) => f.code === 'GEOM.FOOTPRINTS_OVERLAP')).toBe(true);
  });

  it('does not flag non-overlapping same-level footprints', () => {
    const result = validateGeometry(siteWith([
      fp('fp-a', [[0, 0], [5, 0], [5, 5], [0, 5]]),
      fp('fp-b', [[10, 0], [15, 0], [15, 5], [10, 5]]),
    ]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.some((f) => f.code === 'GEOM.FOOTPRINTS_OVERLAP')).toBe(false);
  });

  it('does not flag overlapping footprints on different levels', () => {
    const result = validateGeometry(siteWith([
      fp('fp-a', [[0, 0], [10, 0], [10, 10], [0, 10]], 'l1'),
      fp('fp-b', [[0, 0], [10, 0], [10, 10], [0, 10]], 'l2'),
    ]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.some((f) => f.code === 'GEOM.FOOTPRINTS_OVERLAP')).toBe(false);
  });

  it('detects containment overlap (one inside the other)', () => {
    const result = validateGeometry(siteWith([
      fp('fp-outer', [[0, 0], [20, 0], [20, 20], [0, 20]]),
      fp('fp-inner', [[5, 5], [15, 5], [15, 15], [5, 15]]),
    ]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.some((f) => f.code === 'GEOM.FOOTPRINTS_OVERLAP')).toBe(true);
  });

  it('passes refMinimal without geometry errors', () => {
    const result = validateGeometry(refMinimal);
    expect(result.ok).toBe(true);
  });

  it('detects collinear-overlap self-intersection', () => {
    // Pentagon with collinear edges that backtrack (overlap).
    const result = validateGeometry(siteWith([
      fp('fp-collinear', [[0, 0], [10, 0], [5, 0], [5, 10], [0, 10]]),
    ]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.some((f) =>
      f.code === 'GEOM.POLYGON_SELF_INTERSECTING',
    )).toBe(true);
  });

  it('does not flag touching bboxes as overlap', () => {
    const result = validateGeometry(siteWith([
      fp('fp-left', [[0, 0], [5, 0], [5, 5], [0, 5]]),
      fp('fp-right', [[5, 0], [10, 0], [10, 5], [5, 5]]),
    ]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.some((f) => f.code === 'GEOM.FOOTPRINTS_OVERLAP')).toBe(false);
  });

  it('returns blockings and warnings together when both exist', () => {
    const result = validateGeometry(siteWith([
      fp('fp-bad', [[0, 0]]),
      fp('fp-ov-a', [[0, 0], [10, 0], [10, 10], [0, 10]]),
      fp('fp-ov-b', [[5, 5], [15, 5], [15, 15], [5, 15]]),
    ]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.some((f) => f.severity === 'blocking')).toBe(true);
    expect(result.findings.some((f) => f.severity === 'warning')).toBe(true);
  });

  it('is deterministic (INV-4)', () => {
    const r1 = validateGeometry(siteWith([GOOD_FP]));
    const r2 = validateGeometry(siteWith([GOOD_FP]));
    expect(r1).toStrictEqual(r2);
  });

  it('handles empty site gracefully', () => {
    const result = validateGeometry(siteWith([]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total_footprints).toBe(0);
    expect(result.value.total_volumes).toBe(0);
  });

  it('detects polygon with zero vertices', () => {
    const result = validateGeometry(siteWith([fp('fp-empty', [])]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.some((f) =>
      f.code === 'GEOM.POLYGON_TOO_FEW_VERTICES' && f.entity?.id === 'fp-empty',
    )).toBe(true);
    const finding = result.findings.find((f) => f.entity?.id === 'fp-empty');
    expect((finding?.params as Record<string, unknown>)['vertex_count']).toBe(0);
  });

  it('detects collinear vertices as degenerate (area = 0)', () => {
    const result = validateGeometry(siteWith([
      fp('fp-line', [[0, 0], [5, 0], [10, 0]]),
    ]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.some((f) =>
      f.code === 'GEOM.POLYGON_DEGENERATE' && f.entity?.id === 'fp-line',
    )).toBe(true);
  });

  it('does not flag a valid triangle as self-intersecting', () => {
    const result = validateGeometry(siteWith([
      fp('fp-tri', [[0, 0], [10, 0], [5, 8]]),
    ]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.some((f) =>
      f.code === 'GEOM.POLYGON_SELF_INTERSECTING',
    )).toBe(false);
  });

  it('detects exactly coincident first/last vertex (distance 0)', () => {
    const result = validateGeometry(siteWith([
      fp('fp-dup0', [[0, 0], [10, 0], [10, 10], [0, 0]]),
    ]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.some((f) =>
      f.code === 'GEOM.POLYGON_NOT_CLOSED' && f.entity?.id === 'fp-dup0',
    )).toBe(true);
  });

  it('reports correct valid counts with mixed issues', () => {
    const goodVol: Volume = {
      id: 'v-ok', org_id: 'org1', footprint_id: 'fp-ok',
      base_elevation_m: 0, height_m: 3, material_key: 'concrete',
    };
    const badVol: Volume = {
      id: 'v-bad', org_id: 'org1', footprint_id: 'fp-ok',
      base_elevation_m: 0, height_m: 0, material_key: 'glass',
    };
    const result = validateGeometry(siteWith(
      [fp('fp-ok', [[0, 0], [10, 0], [10, 10], [0, 10]]), fp('fp-bad', [[0, 0]])],
      [goodVol, badVol],
    ));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.filter((f) => f.entity?.kind === 'footprint').length).toBeGreaterThanOrEqual(1);
    expect(result.findings.filter((f) => f.entity?.kind === 'volume').length).toBeGreaterThanOrEqual(1);
  });

  it('does not double-report POLYGON_NOT_CLOSED for a 2-vertex polygon', () => {
    const result = validateGeometry(siteWith([fp('fp-2v', [[0, 0], [5, 5]])]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // polygonNotClosedFindings skips < 3 vertices, so no NOT_CLOSED finding
    expect(result.findings.filter(
      (f) => f.code === 'GEOM.POLYGON_NOT_CLOSED',
    )).toHaveLength(0);
    // tooFewVerticesFindings catches it instead
    expect(result.findings.filter(
      (f) => f.code === 'GEOM.POLYGON_TOO_FEW_VERTICES',
    )).toHaveLength(1);
  });

  it('non-overlapping L-shapes with overlapping bounding boxes pass', () => {
    // Two L-shaped polygons whose bboxes overlap but shapes do not
    const result = validateGeometry(siteWith([
      fp('fp-L1', [[0, 0], [5, 0], [5, 3], [3, 3], [3, 5], [0, 5]]),
      fp('fp-L2', [[6, 0], [10, 0], [10, 5], [8, 5], [8, 3], [6, 3]]),
    ]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.some(
      (f) => f.code === 'GEOM.FOOTPRINTS_OVERLAP',
    )).toBe(false);
  });

  it('first-last distance below POINT_COINCIDENCE_M flagged as not-closed', () => {
    // distance = 0.0005 < 0.001 (POINT_COINCIDENCE_M) → triggers NOT_CLOSED
    // Use 3 vertices (triangle) to skip self-intersection check (n < 4)
    const result = validateGeometry(siteWith([
      fp('fp-close', [[0, 0], [10, 0], [0.0005, 0]]),
    ]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.some((f) => f.code === 'GEOM.POLYGON_NOT_CLOSED')).toBe(true);
  });

  it('polygon area exactly at POLYGON_MIN_AREA_M2 is not degenerate', () => {
    // Triangle with area = 0.5 * 0.02 * 0.01 = 0.0001 m² = POLYGON_MIN_AREA_M2
    const result = validateGeometry(siteWith([
      fp('fp-exact-area', [[0, 0], [0.02, 0], [0, 0.01]]),
    ]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.some((f) => f.code === 'GEOM.POLYGON_DEGENERATE')).toBe(false);
  });

  it('containment detected via second overlap check (small A inside large B)', () => {
    // fp-aaa (small, sorted first) is inside fp-bbb (big), so vertsA[0] inside vertsB fires
    const result = validateGeometry(siteWith([
      fp('fp-aaa', [[5, 5], [15, 5], [15, 15], [5, 15]]),
      fp('fp-bbb', [[0, 0], [20, 0], [20, 20], [0, 20]]),
    ]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.some((f) => f.code === 'GEOM.FOOTPRINTS_OVERLAP')).toBe(true);
  });

  it('containment detected via third overlap check (large A contains small B)', () => {
    // fp-a (big square) sorted first alphabetically contains fp-b (small square)
    // Edges don't cross, vertsA[0]=(0,0) not inside vertsB, but vertsB[0]=(5,5) inside vertsA
    const result = validateGeometry(siteWith([
      fp('fp-a', [[0, 0], [20, 0], [20, 20], [0, 20]]),
      fp('fp-b', [[5, 5], [15, 5], [15, 15], [5, 15]]),
    ]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const overlap = result.warnings.find((f) => f.code === 'GEOM.FOOTPRINTS_OVERLAP');
    expect(overlap).toBeDefined();
    expect(overlap?.params).toHaveProperty('other_footprint_id', 'fp-b');
  });
});
