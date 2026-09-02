import { roundSvg } from '@azimut/core-model';
import type { Point } from '@azimut/core-model';

export type IsoPoint = { readonly x: number; readonly y: number };

export const COS_30 = 0.8660254037844386;
export const SIN_30 = 0.5;

export function toIso(
  x_m: number,
  y_m: number,
  z_m: number,
  scale: number,
): IsoPoint {
  return {
    x: roundSvg((x_m - y_m) * COS_30 * scale),
    y: roundSvg((x_m + y_m) * SIN_30 * scale - z_m * scale),
  };
}

export type IsoTransform = {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
};

export function isoTx(
  x_m: number,
  y_m: number,
  z_m: number,
  t: IsoTransform,
): IsoPoint {
  const raw = toIso(x_m, y_m, z_m, t.scale);
  return {
    x: roundSvg(raw.x + t.offsetX),
    y: roundSvg(raw.y + t.offsetY),
  };
}

export function projectTopFace(
  vertices: readonly Point[],
  topZ: number,
  t: IsoTransform,
): readonly IsoPoint[] {
  return vertices.map((v) => isoTx(v.x_m, v.y_m, topZ, t));
}

export function pointsStr(pts: readonly IsoPoint[]): string {
  return pts.map((p) => `${p.x},${p.y}`).join(' ');
}

export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type WorldBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

export type LevelGeom = {
  readonly vertices: readonly Point[];
  readonly elevation_m: number;
  readonly maxZ: number;
};

export function computeWorldBounds(
  levels: readonly LevelGeom[],
): WorldBounds | null {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let hasData = false;

  for (const ld of levels) {
    for (const v of ld.vertices) {
      minX = Math.min(minX, v.x_m);
      maxX = Math.max(maxX, v.x_m);
      minY = Math.min(minY, v.y_m);
      maxY = Math.max(maxY, v.y_m);
      hasData = true;
    }
    minZ = Math.min(minZ, ld.elevation_m);
    maxZ = Math.max(maxZ, ld.maxZ);
  }

  if (!hasData) return null;
  if (!isFinite(minZ)) minZ = 0;
  if (!isFinite(maxZ)) maxZ = 0;
  return { minX, maxX, minY, maxY, minZ, maxZ };
}

export function computeIsoTransform(
  wb: WorldBounds,
  width: number,
  height: number,
  padding: number,
): IsoTransform {
  const corners: IsoPoint[] = [];
  for (const x of [wb.minX, wb.maxX]) {
    for (const y of [wb.minY, wb.maxY]) {
      for (const z of [wb.minZ, wb.maxZ]) {
        corners.push(toIso(x, y, z, 1));
      }
    }
  }

  let iMinX = Infinity;
  let iMaxX = -Infinity;
  let iMinY = Infinity;
  let iMaxY = -Infinity;
  for (const c of corners) {
    iMinX = Math.min(iMinX, c.x);
    iMaxX = Math.max(iMaxX, c.x);
    iMinY = Math.min(iMinY, c.y);
    iMaxY = Math.max(iMaxY, c.y);
  }

  const isoW = iMaxX - iMinX;
  const isoH = iMaxY - iMinY;
  const availW = width - 2 * padding;
  const availH = height - 2 * padding;

  const scaleX = isoW > 0 ? availW / isoW : 1;
  const scaleY = isoH > 0 ? availH / isoH : 1;
  const scale = Math.min(scaleX, scaleY);

  const tCorners = corners.map((c) => ({
    x: c.x * scale,
    y: c.y * scale,
  }));
  let tMinX = Infinity;
  let tMaxX = -Infinity;
  let tMinY = Infinity;
  let tMaxY = -Infinity;
  for (const c of tCorners) {
    tMinX = Math.min(tMinX, c.x);
    tMaxX = Math.max(tMaxX, c.x);
    tMinY = Math.min(tMinY, c.y);
    tMaxY = Math.max(tMaxY, c.y);
  }
  const usedW = tMaxX - tMinX;
  const usedH = tMaxY - tMinY;

  return {
    scale,
    offsetX: padding + (availW - usedW) / 2 - tMinX,
    offsetY: padding + (availH - usedH) / 2 - tMinY,
  };
}
