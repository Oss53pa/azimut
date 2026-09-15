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
