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
    kind: 'room',
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

describe('sortVolumesPainter — multi-vertex minXplusY', () => {
  it('uses minimum sum across all vertices, not just the first', () => {
    const entries: VolumeEntry[] = [
      // second vertex has smaller sum
      { volume: vol('v1', 'f1', 0, 1), footprint: fp('f1', [{ x_m: 10, y_m: 10 }, { x_m: 1, y_m: 1 }]) },
      { volume: vol('v2', 'f2', 0, 1), footprint: fp('f2', [{ x_m: 5, y_m: 5 }]) },
    ];
    const sorted = sortVolumesPainter(entries);
    // v1 min sum = 2, v2 min sum = 10 → v1 first
    expect(sorted[0]?.volume.id).toBe('v1');
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
