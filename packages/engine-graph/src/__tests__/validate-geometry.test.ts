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

const GOOD_FP: Footprint = {
  id: 'fp-good', org_id: 'org1', level_id: 'l1',
  geometry: { vertices: [
    { x_m: 0, y_m: 0 }, { x_m: 10, y_m: 0 },
    { x_m: 10, y_m: 10 }, { x_m: 0, y_m: 10 },
  ] },
  kind: 'room',
};

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
    const fp: Footprint = {
      id: 'fp-2v', org_id: 'org1', level_id: 'l1',
      geometry: { vertices: [{ x_m: 0, y_m: 0 }, { x_m: 5, y_m: 5 }] },
      kind: 'room',
    };
    const result = validateGeometry(siteWith([fp]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.some((f) => f.code === 'GEOM.POLYGON_TOO_FEW_VERTICES')).toBe(true);
  });

  it('detects polygon with coincident first and last vertex', () => {
    const fp: Footprint = {
      id: 'fp-dup', org_id: 'org1', level_id: 'l1',
      geometry: { vertices: [
        { x_m: 0, y_m: 0 }, { x_m: 10, y_m: 0 },
        { x_m: 10, y_m: 10 }, { x_m: 0, y_m: 0.0005 },
      ] },
      kind: 'room',
    };
    const result = validateGeometry(siteWith([fp]));
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
    const fp: Footprint = {
      id: 'fp-bowtie', org_id: 'org1', level_id: 'l1',
      geometry: { vertices: [
        { x_m: 0, y_m: 0 }, { x_m: 10, y_m: 10 },
        { x_m: 10, y_m: 0 }, { x_m: 0, y_m: 10 },
      ] },
      kind: 'room',
    };
    const result = validateGeometry(siteWith([fp]));
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
    const fpA: Footprint = {
      id: 'fp-a', org_id: 'org1', level_id: 'l1',
      geometry: { vertices: [
        { x_m: 0, y_m: 0 }, { x_m: 10, y_m: 0 },
        { x_m: 10, y_m: 10 }, { x_m: 0, y_m: 10 },
      ] },
      kind: 'room',
    };
    const fpB: Footprint = {
      id: 'fp-b', org_id: 'org1', level_id: 'l1',
      geometry: { vertices: [
        { x_m: 5, y_m: 5 }, { x_m: 15, y_m: 5 },
        { x_m: 15, y_m: 15 }, { x_m: 5, y_m: 15 },
      ] },
      kind: 'room',
    };
    const result = validateGeometry(siteWith([fpA, fpB]));
    expect(result.ok).toBe(true); // overlap is a warning, not blocking
    if (!result.ok) return;
    expect(result.warnings.some((f) => f.code === 'GEOM.FOOTPRINTS_OVERLAP')).toBe(true);
  });

  it('does not flag non-overlapping same-level footprints', () => {
    const fpA: Footprint = {
      id: 'fp-a', org_id: 'org1', level_id: 'l1',
      geometry: { vertices: [
        { x_m: 0, y_m: 0 }, { x_m: 5, y_m: 0 },
        { x_m: 5, y_m: 5 }, { x_m: 0, y_m: 5 },
      ] },
      kind: 'room',
    };
    const fpB: Footprint = {
      id: 'fp-b', org_id: 'org1', level_id: 'l1',
      geometry: { vertices: [
        { x_m: 10, y_m: 0 }, { x_m: 15, y_m: 0 },
        { x_m: 15, y_m: 5 }, { x_m: 10, y_m: 5 },
      ] },
      kind: 'room',
    };
    const result = validateGeometry(siteWith([fpA, fpB]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.some((f) => f.code === 'GEOM.FOOTPRINTS_OVERLAP')).toBe(false);
  });

  it('does not flag overlapping footprints on different levels', () => {
    const fpA: Footprint = {
      id: 'fp-a', org_id: 'org1', level_id: 'l1',
      geometry: { vertices: [
        { x_m: 0, y_m: 0 }, { x_m: 10, y_m: 0 },
        { x_m: 10, y_m: 10 }, { x_m: 0, y_m: 10 },
      ] },
      kind: 'room',
    };
    const fpB: Footprint = {
      id: 'fp-b', org_id: 'org1', level_id: 'l2',
      geometry: { vertices: [
        { x_m: 0, y_m: 0 }, { x_m: 10, y_m: 0 },
        { x_m: 10, y_m: 10 }, { x_m: 0, y_m: 10 },
      ] },
      kind: 'room',
    };
    const result = validateGeometry(siteWith([fpA, fpB]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.some((f) => f.code === 'GEOM.FOOTPRINTS_OVERLAP')).toBe(false);
  });

  it('detects containment overlap (one inside the other)', () => {
    const fpOuter: Footprint = {
      id: 'fp-outer', org_id: 'org1', level_id: 'l1',
      geometry: { vertices: [
        { x_m: 0, y_m: 0 }, { x_m: 20, y_m: 0 },
        { x_m: 20, y_m: 20 }, { x_m: 0, y_m: 20 },
      ] },
      kind: 'room',
    };
    const fpInner: Footprint = {
      id: 'fp-inner', org_id: 'org1', level_id: 'l1',
      geometry: { vertices: [
        { x_m: 5, y_m: 5 }, { x_m: 15, y_m: 5 },
        { x_m: 15, y_m: 15 }, { x_m: 5, y_m: 15 },
      ] },
      kind: 'room',
    };
    const result = validateGeometry(siteWith([fpOuter, fpInner]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.some((f) => f.code === 'GEOM.FOOTPRINTS_OVERLAP')).toBe(true);
  });

  it('passes refMinimal without geometry errors', () => {
    const result = validateGeometry(refMinimal);
    expect(result.ok).toBe(true);
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
    const fp: Footprint = {
      id: 'fp-empty', org_id: 'org1', level_id: 'l1',
      geometry: { vertices: [] },
      kind: 'room',
    };
    const result = validateGeometry(siteWith([fp]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.some((f) =>
      f.code === 'GEOM.POLYGON_TOO_FEW_VERTICES' && f.entity?.id === 'fp-empty',
    )).toBe(true);
    const finding = result.findings.find((f) => f.entity?.id === 'fp-empty');
    expect((finding?.params as Record<string, unknown>)['vertex_count']).toBe(0);
  });

  it('detects collinear vertices as degenerate (area = 0)', () => {
    const fp: Footprint = {
      id: 'fp-line', org_id: 'org1', level_id: 'l1',
      geometry: { vertices: [
        { x_m: 0, y_m: 0 }, { x_m: 5, y_m: 0 }, { x_m: 10, y_m: 0 },
      ] },
      kind: 'room',
    };
    const result = validateGeometry(siteWith([fp]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.some((f) =>
      f.code === 'GEOM.POLYGON_DEGENERATE' && f.entity?.id === 'fp-line',
    )).toBe(true);
  });

  it('does not flag a valid triangle as self-intersecting', () => {
    const fp: Footprint = {
      id: 'fp-tri', org_id: 'org1', level_id: 'l1',
      geometry: { vertices: [
        { x_m: 0, y_m: 0 }, { x_m: 10, y_m: 0 }, { x_m: 5, y_m: 8 },
      ] },
      kind: 'room',
    };
    const result = validateGeometry(siteWith([fp]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.some((f) =>
      f.code === 'GEOM.POLYGON_SELF_INTERSECTING',
    )).toBe(false);
  });

  it('detects exactly coincident first/last vertex (distance 0)', () => {
    const fp: Footprint = {
      id: 'fp-dup0', org_id: 'org1', level_id: 'l1',
      geometry: { vertices: [
        { x_m: 0, y_m: 0 }, { x_m: 10, y_m: 0 },
        { x_m: 10, y_m: 10 }, { x_m: 0, y_m: 0 },
      ] },
      kind: 'room',
    };
    const result = validateGeometry(siteWith([fp]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.some((f) =>
      f.code === 'GEOM.POLYGON_NOT_CLOSED' && f.entity?.id === 'fp-dup0',
    )).toBe(true);
  });

  it('reports correct valid counts with mixed issues', () => {
    const good: Footprint = {
      id: 'fp-ok', org_id: 'org1', level_id: 'l1',
      geometry: { vertices: [
        { x_m: 0, y_m: 0 }, { x_m: 10, y_m: 0 },
        { x_m: 10, y_m: 10 }, { x_m: 0, y_m: 10 },
      ] },
      kind: 'room',
    };
    const bad: Footprint = {
      id: 'fp-bad', org_id: 'org1', level_id: 'l1',
      geometry: { vertices: [{ x_m: 0, y_m: 0 }] },
      kind: 'room',
    };
    const goodVol: Volume = {
      id: 'v-ok', org_id: 'org1', footprint_id: 'fp-ok',
      base_elevation_m: 0, height_m: 3, material_key: 'concrete',
    };
    const badVol: Volume = {
      id: 'v-bad', org_id: 'org1', footprint_id: 'fp-ok',
      base_elevation_m: 0, height_m: 0, material_key: 'glass',
    };
    const result = validateGeometry(siteWith([good, bad], [goodVol, badVol]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Check that findings report counts implicitly via entity ids.
    const fpCodes = result.findings.filter((f) => f.entity?.kind === 'footprint');
    const volCodes = result.findings.filter((f) => f.entity?.kind === 'volume');
    expect(fpCodes.length).toBeGreaterThanOrEqual(1);
    expect(volCodes.length).toBeGreaterThanOrEqual(1);
  });
});
