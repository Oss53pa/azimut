import { describe, it, expect } from 'vitest';
import { sortVolumesPainter, detectOverlaps } from '../painter-sort.js';
import type { VolumeEntry } from '../painter-sort.js';
import type { Footprint, Volume } from '@azimut/core-model';

function fp(id: string, vertices: { x_m: number; y_m: number }[]): Footprint {
  return {
    id,
    org_id: 'org-1',
    level_id: 'lvl-1',
    geometry: { vertices },
    kind: 'cell',
  };
}

function vol(id: string, fpId: string, baseElev: number, height: number): Volume {
  return {
    id,
    org_id: 'org-1',
    footprint_id: fpId,
    base_elevation_m: baseElev,
    height_m: height,
    material_key: 'concrete',
  };
}

describe('D5.2 — sortVolumesPainter', () => {
  it('sorts by base_elevation_m ascending', () => {
    const entries: VolumeEntry[] = [
      { volume: vol('v2', 'f2', 3, 1), footprint: fp('f2', [{ x_m: 0, y_m: 0 }]) },
      { volume: vol('v1', 'f1', 0, 1), footprint: fp('f1', [{ x_m: 0, y_m: 0 }]) },
    ];
    const sorted = sortVolumesPainter(entries);
    expect(sorted[0]?.volume.id).toBe('v1');
    expect(sorted[1]?.volume.id).toBe('v2');
  });

  it('sorts by min(x)+min(y) when elevation is equal', () => {
    const entries: VolumeEntry[] = [
      { volume: vol('v1', 'f1', 0, 1), footprint: fp('f1', [{ x_m: 5, y_m: 5 }]) },
      { volume: vol('v2', 'f2', 0, 1), footprint: fp('f2', [{ x_m: 1, y_m: 1 }]) },
    ];
    const sorted = sortVolumesPainter(entries);
    expect(sorted[0]?.volume.id).toBe('v2');
    expect(sorted[1]?.volume.id).toBe('v1');
  });

  it('sorts by volume id as tiebreaker (D5.2 determinism)', () => {
    const entries: VolumeEntry[] = [
      { volume: vol('v-beta', 'f1', 0, 1), footprint: fp('f1', [{ x_m: 0, y_m: 0 }]) },
      { volume: vol('v-alpha', 'f2', 0, 1), footprint: fp('f2', [{ x_m: 0, y_m: 0 }]) },
    ];
    const sorted = sortVolumesPainter(entries);
    expect(sorted[0]?.volume.id).toBe('v-alpha');
    expect(sorted[1]?.volume.id).toBe('v-beta');
  });

  it('is stable for equal entries', () => {
    const shared = fp('f1', [{ x_m: 0, y_m: 0 }]);
    const entry: VolumeEntry = { volume: vol('v1', 'f1', 0, 1), footprint: shared };
    const sorted = sortVolumesPainter([entry]);
    expect(sorted).toHaveLength(1);
  });

  it('handles empty input', () => {
    expect(sortVolumesPainter([])).toEqual([]);
  });
});

describe('K2.1 — sortVolumesPainter with manual render_order', () => {
  const withOrder = (v: Volume, render_order: number | null): Volume => ({
    ...v,
    render_order,
  });

  it('leaves the computed order unchanged when no render_order is set', () => {
    const entries: VolumeEntry[] = [
      { volume: vol('v2', 'f2', 3, 1), footprint: fp('f2', [{ x_m: 0, y_m: 0 }]) },
      { volume: vol('v1', 'f1', 0, 1), footprint: fp('f1', [{ x_m: 0, y_m: 0 }]) },
    ];
    const sorted = sortVolumesPainter(entries);
    expect(sorted.map((e) => e.volume.id)).toEqual(['v1', 'v2']);
  });

  it('draws an explicit volume after (on top of) auto volumes, overriding elevation', () => {
    // v-high sits higher and would compute last; giving v-low a render_order
    // promotes it above the auto volume regardless of elevation.
    const entries: VolumeEntry[] = [
      { volume: withOrder(vol('v-high', 'f1', 10, 1), null), footprint: fp('f1', [{ x_m: 0, y_m: 0 }]) },
      { volume: withOrder(vol('v-low', 'f2', 0, 1), 5), footprint: fp('f2', [{ x_m: 0, y_m: 0 }]) },
    ];
    const sorted = sortVolumesPainter(entries);
    expect(sorted.map((e) => e.volume.id)).toEqual(['v-high', 'v-low']);
  });

  it('orders two explicit volumes by ascending render_order, ignoring elevation', () => {
    const entries: VolumeEntry[] = [
      { volume: withOrder(vol('v-a', 'f1', 9, 1), 2), footprint: fp('f1', [{ x_m: 0, y_m: 0 }]) },
      { volume: withOrder(vol('v-b', 'f2', 0, 1), 1), footprint: fp('f2', [{ x_m: 0, y_m: 0 }]) },
    ];
    const sorted = sortVolumesPainter(entries);
    expect(sorted.map((e) => e.volume.id)).toEqual(['v-b', 'v-a']);
  });

  it('falls back to the computed sort when render_order ties', () => {
    const entries: VolumeEntry[] = [
      { volume: withOrder(vol('v-beta', 'f1', 0, 1), 7), footprint: fp('f1', [{ x_m: 0, y_m: 0 }]) },
      { volume: withOrder(vol('v-alpha', 'f2', 0, 1), 7), footprint: fp('f2', [{ x_m: 0, y_m: 0 }]) },
    ];
    const sorted = sortVolumesPainter(entries);
    expect(sorted.map((e) => e.volume.id)).toEqual(['v-alpha', 'v-beta']);
  });

  it('is deterministic regardless of input order', () => {
    const a = { volume: withOrder(vol('v-a', 'f1', 0, 1), 3), footprint: fp('f1', [{ x_m: 0, y_m: 0 }]) };
    const b = { volume: withOrder(vol('v-b', 'f2', 5, 1), null), footprint: fp('f2', [{ x_m: 0, y_m: 0 }]) };
    const s1 = sortVolumesPainter([a, b]).map((e) => e.volume.id);
    const s2 = sortVolumesPainter([b, a]).map((e) => e.volume.id);
    expect(s1).toEqual(s2);
  });
});

describe('D5.2 — detectOverlaps', () => {
  it('detects bounding-box overlap', () => {
    const footprints = [
      fp('f1', [{ x_m: 0, y_m: 0 }, { x_m: 2, y_m: 0 }, { x_m: 2, y_m: 2 }, { x_m: 0, y_m: 2 }]),
      fp('f2', [{ x_m: 1, y_m: 1 }, { x_m: 3, y_m: 1 }, { x_m: 3, y_m: 3 }, { x_m: 1, y_m: 3 }]),
    ];
    const findings = detectOverlaps(footprints);
    expect(findings.length).toBe(1);
    expect(findings[0]?.code).toBe('GEOM.FOOTPRINTS_OVERLAP');
  });

  it('no overlap for separated footprints', () => {
    const footprints = [
      fp('f1', [{ x_m: 0, y_m: 0 }, { x_m: 1, y_m: 0 }, { x_m: 1, y_m: 1 }, { x_m: 0, y_m: 1 }]),
      fp('f2', [{ x_m: 5, y_m: 5 }, { x_m: 6, y_m: 5 }, { x_m: 6, y_m: 6 }, { x_m: 5, y_m: 6 }]),
    ];
    expect(detectOverlaps(footprints)).toEqual([]);
  });

  it('handles empty footprints', () => {
    expect(detectOverlaps([])).toEqual([]);
  });

  it('detects all pairs in triple overlap', () => {
    const footprints = [
      fp('f1', [{ x_m: 0, y_m: 0 }, { x_m: 3, y_m: 0 }, { x_m: 3, y_m: 3 }, { x_m: 0, y_m: 3 }]),
      fp('f2', [{ x_m: 1, y_m: 1 }, { x_m: 4, y_m: 1 }, { x_m: 4, y_m: 4 }, { x_m: 1, y_m: 4 }]),
      fp('f3', [{ x_m: 2, y_m: 2 }, { x_m: 5, y_m: 2 }, { x_m: 5, y_m: 5 }, { x_m: 2, y_m: 5 }]),
    ];
    const findings = detectOverlaps(footprints);
    // 3 pairs: (f1,f2), (f1,f3), (f2,f3)
    expect(findings.length).toBe(3);
  });

  it('single footprint produces no overlaps', () => {
    const footprints = [
      fp('f1', [{ x_m: 0, y_m: 0 }, { x_m: 1, y_m: 0 }, { x_m: 1, y_m: 1 }, { x_m: 0, y_m: 1 }]),
    ];
    expect(detectOverlaps(footprints)).toEqual([]);
  });

  it('edge-touching footprints do not overlap (strict inequality)', () => {
    const footprints = [
      fp('f1', [{ x_m: 0, y_m: 0 }, { x_m: 2, y_m: 0 }, { x_m: 2, y_m: 2 }, { x_m: 0, y_m: 2 }]),
      fp('f2', [{ x_m: 2, y_m: 0 }, { x_m: 4, y_m: 0 }, { x_m: 4, y_m: 2 }, { x_m: 2, y_m: 2 }]),
    ];
    expect(detectOverlaps(footprints)).toEqual([]);
  });

  it('overlap params contain correct footprint IDs', () => {
    const footprints = [
      fp('fp-A', [{ x_m: 0, y_m: 0 }, { x_m: 2, y_m: 2 }]),
      fp('fp-B', [{ x_m: 1, y_m: 1 }, { x_m: 3, y_m: 3 }]),
    ];
    const findings = detectOverlaps(footprints);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.params['footprint_a']).toBe('fp-A');
    expect(findings[0]?.params['footprint_b']).toBe('fp-B');
    expect(findings[0]?.entity?.id).toBe('fp-A');
  });

  it('negative coordinates work correctly', () => {
    const footprints = [
      fp('f1', [{ x_m: -5, y_m: -5 }, { x_m: -2, y_m: -2 }]),
      fp('f2', [{ x_m: -3, y_m: -3 }, { x_m: 0, y_m: 0 }]),
    ];
    const findings = detectOverlaps(footprints);
    expect(findings).toHaveLength(1);
  });
});

describe('sortVolumesPainter — footprint depth min(x)+min(y)', () => {
  it('uses minimum x and minimum y across all vertices', () => {
    const entries: VolumeEntry[] = [
      { volume: vol('v1', 'f1', 0, 1), footprint: fp('f1', [{ x_m: 10, y_m: 10 }, { x_m: 1, y_m: 1 }]) },
      { volume: vol('v2', 'f2', 0, 1), footprint: fp('f2', [{ x_m: 5, y_m: 5 }]) },
    ];
    const sorted = sortVolumesPainter(entries);
    // v1 depth = minX(1)+minY(1) = 2, v2 depth = 10 → v1 first
    expect(sorted[0]?.volume.id).toBe('v1');
  });

  it('takes minX and minY from different vertices (not min of x+y)', () => {
    // f1 vertices (0,10) and (10,0): min(x)+min(y) = 0, but min(x+y) = 10.
    // f2 single vertex (4,4): depth 8. With the correct min(x)+min(y)=0,
    // f1 sorts first; with the wrong min(x+y)=10 it would sort last.
    const entries: VolumeEntry[] = [
      { volume: vol('v2', 'f2', 0, 1), footprint: fp('f2', [{ x_m: 4, y_m: 4 }]) },
      { volume: vol('v1', 'f1', 0, 1), footprint: fp('f1', [{ x_m: 0, y_m: 10 }, { x_m: 10, y_m: 0 }]) },
    ];
    const sorted = sortVolumesPainter(entries);
    expect(sorted[0]?.volume.id).toBe('v1');
    expect(sorted[1]?.volume.id).toBe('v2');
  });

  it('breaks ties by UTF-8 byte order, not UTF-16 code units', () => {
    // '！' (U+FF01) UTF-8 = EF BC 81; '\u{1F600}' (U+1F600) UTF-8 = F0 9F 98 80.
    // By bytes, EF < F0 so '！' sorts first. Native UTF-16 `<` would put the
    // emoji (lead unit 0xD83D) before '！' (0xFF01) — the opposite order.
    const same = (id: string): VolumeEntry => ({
      volume: vol(id, 'f', 0, 1),
      footprint: fp('f', [{ x_m: 0, y_m: 0 }]),
    });
    const sorted = sortVolumesPainter([same('\u{1F600}'), same('！')]);
    expect(sorted[0]?.volume.id).toBe('！');
    expect(sorted[1]?.volume.id).toBe('\u{1F600}');
  });

  it('identical entries yield comparator 0 (same id, elevation, minXplusY)', () => {
    const shared = fp('f-same', [{ x_m: 3, y_m: 3 }]);
    const entries: VolumeEntry[] = [
      { volume: vol('v-same', 'f-same', 0, 1), footprint: shared },
      { volume: vol('v-same', 'f-same', 0, 1), footprint: shared },
    ];
    const sorted = sortVolumesPainter(entries);
    expect(sorted).toHaveLength(2);
    // Both survive — comparator returning 0 keeps original order
    expect(sorted[0]?.volume.id).toBe('v-same');
    expect(sorted[1]?.volume.id).toBe('v-same');
  });

  it('empty vertices returns Infinity sum → sorts last', () => {
    const entries: VolumeEntry[] = [
      { volume: vol('v-empty', 'f-empty', 0, 1), footprint: fp('f-empty', []) },
      { volume: vol('v-real', 'f-real', 0, 1), footprint: fp('f-real', [{ x_m: 0, y_m: 0 }]) },
    ];
    const sorted = sortVolumesPainter(entries);
    expect(sorted[0]?.volume.id).toBe('v-real');
    expect(sorted[1]?.volume.id).toBe('v-empty');
  });
});
