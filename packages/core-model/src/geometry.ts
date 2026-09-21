export type Point = {
  readonly x_m: number;
  readonly y_m: number;
};

export type Polygon = {
  readonly vertices: readonly Point[];
};

/**
 * Aire signée d'un polygone simple (formule du lacet). Positive dans le sens
 * trigonométrique, négative dans le sens horaire.
 *
 * Une seule implémentation : le moteur de géométrie et les écrans lisent la
 * même (invariant 1). Ne pas la réécrire ailleurs.
 */
export function signedArea(vertices: readonly Point[]): number {
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const cur = vertices[i];
    const next = vertices[(i + 1) % n];
    if (cur === undefined || next === undefined) continue;
    area += cur.x_m * next.y_m - next.x_m * cur.y_m;
  }
  return area / 2;
}

/** Aire d'un polygone simple, en mètres carrés, toujours positive. */
export function polygonArea(polygon: Polygon): number {
  return Math.abs(signedArea(polygon.vertices));
}

// ---------------------------------------------------------------------------
// Auto-intersection
// ---------------------------------------------------------------------------

/** Produit vectoriel de (b − a) × (c − a). */
function cross(a: Point, b: Point, c: Point): number {
  return (b.x_m - a.x_m) * (c.y_m - a.y_m) - (b.y_m - a.y_m) * (c.x_m - a.x_m);
}

/** Vrai quand `q` est sur le segment [p, r], les trois étant colinéaires. */
function onSegment(p: Point, q: Point, r: Point): boolean {
  return q.x_m <= Math.max(p.x_m, r.x_m)
    && q.x_m >= Math.min(p.x_m, r.x_m)
    && q.y_m <= Math.max(p.y_m, r.y_m)
    && q.y_m >= Math.min(p.y_m, r.y_m);
}

/**
 * Vrai quand les segments [p1,p2] et [p3,p4] se croisent réellement — et non
 * quand ils se touchent seulement par une extrémité.
 */
export function segmentsProperlyIntersect(
  p1: Point, p2: Point, p3: Point, p4: Point,
): boolean {
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0))
    && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  // Cas colinéaires : on regarde le recouvrement.
  if (d1 === 0 && onSegment(p3, p1, p4)) return true;
  if (d2 === 0 && onSegment(p3, p2, p4)) return true;
  if (d3 === 0 && onSegment(p1, p3, p2)) return true;
  if (d4 === 0 && onSegment(p1, p4, p2)) return true;

  return false;
}

/**
 * Vrai quand le contour se recoupe lui-même.
 *
 * Une seule implémentation, deux appelants : la validation de complétude du
 * site (`engine-graph`) et le contrôle à la saisie de l'écran M3 (partie M).
 * Deux implémentations du même prédicat finiraient par diverger, et l'écran
 * accepterait alors un contour que la validation refuse — ou l'inverse, ce
 * qui est pire : l'opérateur corrigerait un tracé que rien ne reproche.
 *
 * Un triangle ne peut pas se recouper : en deçà de quatre sommets, la réponse
 * est non sans calcul.
 */
export function isSelfIntersecting(vertices: readonly Point[]): boolean {
  const n = vertices.length;
  if (n < 4) return false;

  for (let i = 0; i < n; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    if (a === undefined || b === undefined) continue;
    for (let j = i + 2; j < n; j += 1) {
      // L'arête qui partage un sommet avec l'arête i n'est pas comparée.
      if (j === (i + n - 1) % n) continue;
      const c = vertices[j];
      const d = vertices[(j + 1) % n];
      if (c === undefined || d === undefined) continue;
      if (segmentsProperlyIntersect(a, b, c, d)) return true;
    }
  }
  return false;
}
