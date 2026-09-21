/**
 * Projection du niveau sur la surface de calage.
 *
 * À défaut d'un fond téléversé — l'application n'a pas de dépôt de fichier — la
 * surface rend les empreintes du niveau. Deux surfaces s'en servent, celle du
 * calage à deux points et celle du calage mesuré, et elles doivent cadrer
 * identiquement : un même niveau, un même cadrage. D'où une seule
 * implémentation, ici (invariant 1).
 */
import type { Point, SiteData } from '@azimut/core-model';

export const SURFACE_WIDTH = 640;
export const SURFACE_HEIGHT = 380;

/** Marge autour du contenu, en pixels de surface. */
const PADDING = 20;

export type Outline = {
  readonly id: string;
  readonly points: string;
};

export type SurfaceProjection = {
  readonly outlines: readonly Outline[];
  /** Projette un point du repère métier sur la surface. */
  readonly toSurface: (point: Point) => { readonly x: number; readonly y: number };
};

/**
 * Cadre le niveau sur la surface. Sans empreinte, l'échelle est neutre et
 * l'origine au coin : la surface reste cliquable, elle ne montre simplement
 * rien.
 */
export function projectLevel(site: SiteData, levelId: string): SurfaceProjection {
  const footprints = site.footprints.filter((f) => f.level_id === levelId);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const footprint of footprints) {
    for (const vertex of footprint.geometry.vertices) {
      minX = Math.min(minX, vertex.x_m);
      minY = Math.min(minY, vertex.y_m);
      maxX = Math.max(maxX, vertex.x_m);
      maxY = Math.max(maxY, vertex.y_m);
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return {
      outlines: [],
      toSurface: (point) => ({ x: PADDING + point.x_m, y: PADDING + point.y_m }),
    };
  }

  const spanX = Math.max(maxX - minX, 0.001);
  const spanY = Math.max(maxY - minY, 0.001);
  const scale = Math.min(
    (SURFACE_WIDTH - 2 * PADDING) / spanX,
    (SURFACE_HEIGHT - 2 * PADDING) / spanY,
  );

  const toSurface = (point: Point): { x: number; y: number } => ({
    x: PADDING + (point.x_m - minX) * scale,
    y: PADDING + (point.y_m - minY) * scale,
  });

  return {
    outlines: footprints.map((footprint): Outline => ({
      id: footprint.id,
      points: footprint.geometry.vertices
        .map((vertex) => {
          const projected = toSurface(vertex);
          return `${String(projected.x)},${String(projected.y)}`;
        })
        .join(' '),
    })),
    toSurface,
  };
}
