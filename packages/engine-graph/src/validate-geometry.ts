import type {
  SiteData,
  Footprint,
  Volume,
  Finding,
  Outcome,
  Point,
} from '@azimut/core-model';
import { POINT_COINCIDENCE_M, POLYGON_MIN_AREA_M2 } from '@azimut/core-model';

export type GeometryValidationResult = {
  readonly total_footprints: number;
  readonly total_volumes: number;
  readonly valid_footprints: number;
  readonly valid_volumes: number;
};

// ── Helpers ────────────────────────────────────────────────

function distance(a: Point, b: Point): number {
  const dx = a.x_m - b.x_m;
  const dy = a.y_m - b.y_m;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Shoelace formula — returns the signed area of a simple polygon.
 * Positive = counter-clockwise, negative = clockwise.
 */
function signedArea(vertices: readonly Point[]): number {
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const cur = vertices[i] as Point;
    const next = vertices[(i + 1) % n] as Point;
    area += cur.x_m * next.y_m - next.x_m * cur.y_m;
  }
  return area / 2;
}

/**
 * Cross product of vectors (b - a) × (c - a).
 */
function cross(a: Point, b: Point, c: Point): number {
  return (b.x_m - a.x_m) * (c.y_m - a.y_m) - (b.y_m - a.y_m) * (c.x_m - a.x_m);
}

/**
 * Check if point q lies on segment [p, r], given that p, q, r are collinear.
 */
function onSegment(p: Point, q: Point, r: Point): boolean {
  return (
    q.x_m <= Math.max(p.x_m, r.x_m) &&
    q.x_m >= Math.min(p.x_m, r.x_m) &&
    q.y_m <= Math.max(p.y_m, r.y_m) &&
    q.y_m >= Math.min(p.y_m, r.y_m)
  );
}

/**
 * Test whether segments [p1,p2] and [p3,p4] properly intersect
 * (cross each other, not just touch at endpoints).
 */
function segmentsProperlyIntersect(
  p1: Point, p2: Point,
  p3: Point, p4: Point,
): boolean {
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  // Collinear cases — check overlap.
  if (d1 === 0 && onSegment(p3, p1, p4)) return true;
  if (d2 === 0 && onSegment(p3, p2, p4)) return true;
  if (d3 === 0 && onSegment(p1, p3, p2)) return true;
  if (d4 === 0 && onSegment(p1, p4, p2)) return true;

  return false;
}

// ── Checks ─────────────────────────────────────────────────

function tooFewVerticesFindings(footprints: readonly Footprint[]): Finding[] {
  const findings: Finding[] = [];
  for (const fp of footprints) {
    if (fp.geometry.vertices.length < 3) {
      findings.push({
        code: 'GEOM.POLYGON_TOO_FEW_VERTICES',
        severity: 'blocking',
        entity: { kind: 'footprint', id: fp.id },
        params: { vertex_count: fp.geometry.vertices.length },
        ruleRef: null,
      });
    }
  }
  return findings;
}

function polygonNotClosedFindings(footprints: readonly Footprint[]): Finding[] {
  const findings: Finding[] = [];
  for (const fp of footprints) {
    const verts = fp.geometry.vertices;
    if (verts.length < 3) continue;
    const first = verts[0] as Point;
    const last = verts[verts.length - 1] as Point;
    // The model uses implicit closure; if first ≈ last the polygon has a
    // degenerate duplicate vertex, effectively reducing the vertex count.
    if (distance(first, last) < POINT_COINCIDENCE_M) {
      findings.push({
        code: 'GEOM.POLYGON_NOT_CLOSED',
        severity: 'blocking',
        entity: { kind: 'footprint', id: fp.id },
        params: { distance_m: distance(first, last) },
        ruleRef: null,
      });
    }
  }
  return findings;
}

function polygonDegenerateFindings(footprints: readonly Footprint[]): Finding[] {
  const findings: Finding[] = [];
  for (const fp of footprints) {
    if (fp.geometry.vertices.length < 3) continue;
    const area = Math.abs(signedArea(fp.geometry.vertices));
    if (area < POLYGON_MIN_AREA_M2) {
      findings.push({
        code: 'GEOM.POLYGON_DEGENERATE',
        severity: 'blocking',
        entity: { kind: 'footprint', id: fp.id },
        params: { area_m2: Math.round(area * 1e6) / 1e6 },
        ruleRef: null,
      });
    }
  }
  return findings;
}

function selfIntersectingFindings(footprints: readonly Footprint[]): Finding[] {
  const findings: Finding[] = [];
  for (const fp of footprints) {
    const verts = fp.geometry.vertices;
    const n = verts.length;
    if (n < 4) continue; // Triangle cannot self-intersect.

    let intersects = false;
    outer:
    for (let i = 0; i < n && !intersects; i++) {
      const a = verts[i] as Point;
      const b = verts[(i + 1) % n] as Point;
      // Check against non-adjacent edges.
      for (let j = i + 2; j < n; j++) {
        // Skip the edge that shares a vertex with edge i.
        if (j === (i + n - 1) % n) continue;
        const c = verts[j] as Point;
        const d = verts[(j + 1) % n] as Point;
        if (segmentsProperlyIntersect(a, b, c, d)) {
          intersects = true;
          break outer;
        }
      }
    }

    if (intersects) {
      findings.push({
        code: 'GEOM.POLYGON_SELF_INTERSECTING',
        severity: 'blocking',
        entity: { kind: 'footprint', id: fp.id },
        params: {},
        ruleRef: null,
      });
    }
  }
  return findings;
}

function volumeNoHeightFindings(volumes: readonly Volume[]): Finding[] {
  const findings: Finding[] = [];
  for (const v of volumes) {
    if (v.height_m <= 0) {
      findings.push({
        code: 'GEOM.VOLUME_NO_HEIGHT',
        severity: 'blocking',
        entity: { kind: 'volume', id: v.id },
        params: { height_m: v.height_m },
        ruleRef: null,
      });
    }
  }
  return findings;
}

/**
 * Axis-aligned bounding box of a polygon.
 */
function bbox(verts: readonly Point[]): {
  minX: number; minY: number; maxX: number; maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const v of verts) {
    if (v.x_m < minX) minX = v.x_m;
    if (v.y_m < minY) minY = v.y_m;
    if (v.x_m > maxX) maxX = v.x_m;
    if (v.y_m > maxY) maxY = v.y_m;
  }
  return { minX, minY, maxX, maxY };
}

function bboxOverlap(
  a: ReturnType<typeof bbox>,
  b: ReturnType<typeof bbox>,
): boolean {
  return a.minX < b.maxX && a.maxX > b.minX &&
         a.minY < b.maxY && a.maxY > b.minY;
}

/**
 * Check any edge of polygon A crosses any edge of polygon B.
 */
function polygonsEdgesIntersect(
  vertsA: readonly Point[],
  vertsB: readonly Point[],
): boolean {
  const nA = vertsA.length;
  const nB = vertsB.length;
  for (let i = 0; i < nA; i++) {
    const a1 = vertsA[i] as Point;
    const a2 = vertsA[(i + 1) % nA] as Point;
    for (let j = 0; j < nB; j++) {
      const b1 = vertsB[j] as Point;
      const b2 = vertsB[(j + 1) % nB] as Point;
      if (segmentsProperlyIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

/**
 * Ray-casting point-in-polygon test.
 */
function pointInPolygon(pt: Point, verts: readonly Point[]): boolean {
  let inside = false;
  const n = verts.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const vi = verts[i] as Point;
    const vj = verts[j] as Point;
    if (
      (vi.y_m > pt.y_m) !== (vj.y_m > pt.y_m) &&
      pt.x_m < ((vj.x_m - vi.x_m) * (pt.y_m - vi.y_m)) / (vj.y_m - vi.y_m) + vi.x_m
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function footprintsOverlapFindings(
  footprints: readonly Footprint[],
): Finding[] {
  const findings: Finding[] = [];
  // Group by level for same-level overlap check.
  const byLevel = new Map<string, Footprint[]>();
  for (const fp of footprints) {
    if (fp.geometry.vertices.length < 3) continue;
    const list = byLevel.get(fp.level_id);
    if (list) {
      list.push(fp);
    } else {
      byLevel.set(fp.level_id, [fp]);
    }
  }

  const reported = new Set<string>();

  for (const [, group] of [...byLevel.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const sorted = [...group].sort((a, b) => a.id.localeCompare(b.id));
    const bboxes = sorted.map((fp) => bbox(fp.geometry.vertices));

    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const fpA = sorted[i] as Footprint;
        const fpB = sorted[j] as Footprint;
        const bA = bboxes[i] as ReturnType<typeof bbox>;
        const bB = bboxes[j] as ReturnType<typeof bbox>;

        if (!bboxOverlap(bA, bB)) continue;

        const vertsA = fpA.geometry.vertices;
        const vertsB = fpB.geometry.vertices;

        const overlaps =
          polygonsEdgesIntersect(vertsA, vertsB) ||
          pointInPolygon(vertsA[0] as Point, vertsB) ||
          pointInPolygon(vertsB[0] as Point, vertsA);

        if (overlaps) {
          const pairKey = `${fpA.id}:${fpB.id}`;
          if (!reported.has(pairKey)) {
            reported.add(pairKey);
            findings.push({
              code: 'GEOM.FOOTPRINTS_OVERLAP',
              severity: 'warning',
              entity: { kind: 'footprint', id: fpA.id },
              params: { other_footprint_id: fpB.id },
              ruleRef: null,
            });
          }
        }
      }
    }
  }

  return findings;
}

// ── Main ───────────────────────────────────────────────────

export function validateGeometry(
  site: SiteData,
): Outcome<GeometryValidationResult> {
  const sortedFootprints = [...site.footprints].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const sortedVolumes = [...site.volumes].sort((a, b) =>
    a.id.localeCompare(b.id),
  );

  const allFindings: Finding[] = [
    ...tooFewVerticesFindings(sortedFootprints),
    ...polygonNotClosedFindings(sortedFootprints),
    ...polygonDegenerateFindings(sortedFootprints),
    ...selfIntersectingFindings(sortedFootprints),
    ...volumeNoHeightFindings(sortedVolumes),
    ...footprintsOverlapFindings(sortedFootprints),
  ];

  const fpWithIssues = new Set(
    allFindings
      .filter((f) => f.entity?.kind === 'footprint')
      .map((f) => f.entity?.id),
  );
  const volWithIssues = new Set(
    allFindings
      .filter((f) => f.entity?.kind === 'volume')
      .map((f) => f.entity?.id),
  );

  const result: GeometryValidationResult = {
    total_footprints: sortedFootprints.length,
    total_volumes: sortedVolumes.length,
    valid_footprints: sortedFootprints.length - fpWithIssues.size,
    valid_volumes: sortedVolumes.length - volWithIssues.size,
  };

  const blockings = allFindings.filter((f) => f.severity === 'blocking');
  const warnings = allFindings.filter(
    (f) => f.severity === 'warning' || f.severity === 'info',
  );

  if (blockings.length > 0) {
    return { ok: false, findings: [...blockings, ...warnings] };
  }

  return { ok: true, value: result, warnings };
}
