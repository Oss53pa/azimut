import type { Point, Footprint, Volume, Finding } from '@azimut/core-model';

export type VolumeEntry = {
  readonly volume: Volume;
  readonly footprint: Footprint;
};

/**
 * D5.2 criterion 2 — `min(x) + min(y)` of the footprint, computed over the
 * vertices. The two minima are taken independently (they may come from
 * different vertices), which is not the same as `min(x + y)`.
 */
function footprintDepth(vertices: readonly Point[]): number {
  let minX = Infinity;
  let minY = Infinity;
  for (const v of vertices) {
    if (v.x_m < minX) minX = v.x_m;
    if (v.y_m < minY) minY = v.y_m;
  }
  return minX + minY;
}

const utf8Encoder = new TextEncoder();

/**
 * D5.2 criterion 3 — byte-wise lexicographic comparison of volume ids, so the
 * tiebreaker is deterministic across implementations regardless of the
 * runtime's native string ordering (which is UTF-16 code-unit based).
 */
function compareUtf8Bytes(a: string, b: string): number {
  const ba = utf8Encoder.encode(a);
  const bb = utf8Encoder.encode(b);
  const len = ba.length < bb.length ? ba.length : bb.length;
  for (let i = 0; i < len; i++) {
    const d = (ba[i] as number) - (bb[i] as number);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  if (ba.length === bb.length) return 0;
  return ba.length < bb.length ? -1 : 1;
}

/**
 * K2.1 — Manual painter order. A volume's `render_order`, when set, takes
 * precedence over the computed depth sort. Volumes without one (null/absent,
 * the default) keep the computed order and are drawn first (behind); volumes
 * with a render_order are drawn after them, in ascending render_order, so a
 * manual value promotes a volume above the auto-sorted ones. With no
 * render_order set anywhere, every volume ties here and the computed sort below
 * decides exactly as before.
 */
function manualOrderKey(volume: Volume): number {
  return volume.render_order ?? Number.NEGATIVE_INFINITY;
}

export function sortVolumesPainter(
  entries: readonly VolumeEntry[],
): readonly VolumeEntry[] {
  return [...entries].sort((a, b) => {
    const orderA = manualOrderKey(a.volume);
    const orderB = manualOrderKey(b.volume);
    if (orderA !== orderB) return orderA - orderB;

    const elev = a.volume.base_elevation_m - b.volume.base_elevation_m;
    if (elev !== 0) return elev;

    const depthA = footprintDepth(a.footprint.geometry.vertices);
    const depthB = footprintDepth(b.footprint.geometry.vertices);
    const depth = depthA - depthB;
    if (depth !== 0) return depth;

    return compareUtf8Bytes(a.volume.id, b.volume.id);
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
          // K2.1 — propose manual painter order (volume.render_order).
          params: { footprint_a: fpA.id, footprint_b: fpB.id, remedy: 'render_order' },
          ruleRef: null,
        });
      }
    }
  }
  return findings;
}
