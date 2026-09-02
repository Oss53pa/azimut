import type { Point, Footprint, Volume, Finding } from '@azimut/core-model';

export type VolumeEntry = {
  readonly volume: Volume;
  readonly footprint: Footprint;
};

function minXplusY(vertices: readonly Point[]): number {
  let min = Infinity;
  for (const v of vertices) {
    const sum = v.x_m + v.y_m;
    if (sum < min) min = sum;
  }
  return min;
}

export function sortVolumesPainter(
  entries: readonly VolumeEntry[],
): readonly VolumeEntry[] {
  return [...entries].sort((a, b) => {
    const elev = a.volume.base_elevation_m - b.volume.base_elevation_m;
    if (elev !== 0) return elev;

    const depthA = minXplusY(a.footprint.geometry.vertices);
    const depthB = minXplusY(b.footprint.geometry.vertices);
    const depth = depthA - depthB;
    if (depth !== 0) return depth;

    return a.volume.id < b.volume.id ? -1
      : a.volume.id > b.volume.id ? 1
        : 0;
  });
}

type BBox = {
  minX: number; maxX: number;
  minY: number; maxY: number;
};

function bbox(vertices: readonly Point[]): BBox {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const v of vertices) {
    if (v.x_m < minX) minX = v.x_m;
    if (v.x_m > maxX) maxX = v.x_m;
    if (v.y_m < minY) minY = v.y_m;
    if (v.y_m > maxY) maxY = v.y_m;
  }
  return { minX, maxX, minY, maxY };
}

function bboxOverlap(a: BBox, b: BBox): boolean {
  return a.minX < b.maxX && a.maxX > b.minX
    && a.minY < b.maxY && a.maxY > b.minY;
}

export function detectOverlaps(
  footprints: readonly Footprint[],
): readonly Finding[] {
  const findings: Finding[] = [];
  for (let i = 0; i < footprints.length; i++) {
    const fpA = footprints[i];
    if (!fpA) continue;
    const boxA = bbox(fpA.geometry.vertices);
    for (let j = i + 1; j < footprints.length; j++) {
      const fpB = footprints[j];
      if (!fpB) continue;
      if (bboxOverlap(boxA, bbox(fpB.geometry.vertices))) {
        findings.push({
          code: 'GEOM.FOOTPRINTS_OVERLAP',
          severity: 'warning',
          entity: { kind: 'footprint', id: fpA.id },
          params: { footprint_a: fpA.id, footprint_b: fpB.id },
          ruleRef: null,
        });
      }
    }
  }
  return findings;
}
