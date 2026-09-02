import type {
  SiteData,
  Level,
  Footprint,
  Volume,
  GraphNode,
  Point,
  Outcome,
  Finding,
} from '@azimut/core-model';
import { roundSvg } from '@azimut/core-model';

export type IsoTheme = {
  readonly background: string;
  readonly floor_top: string;
  readonly floor_stroke: string;
  readonly wall_front: string;
  readonly wall_side: string;
  readonly wall_stroke: string;
  readonly node_fill: string;
  readonly node_stroke: string;
  readonly text_primary: string;
};

export type IsoOptions = {
  readonly width_px: number;
  readonly height_px: number;
  readonly theme: IsoTheme;
  readonly font_family: string;
  readonly padding_px: number;
  readonly show_nodes: boolean;
};

export type IsoLevelData = {
  readonly level: Level;
  readonly footprints: readonly Footprint[];
  readonly volumes: readonly Volume[];
  readonly nodes: readonly GraphNode[];
};

type IsoPoint = { readonly x: number; readonly y: number };

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const COS_30 = 0.8660254037844386;
const SIN_30 = 0.5;

function toIso(x_m: number, y_m: number, z_m: number, scale: number): IsoPoint {
  return {
    x: roundSvg((x_m - y_m) * COS_30 * scale),
    y: roundSvg((x_m + y_m) * SIN_30 * scale - z_m * scale),
  };
}

function computeWorldBounds(
  levels: readonly IsoLevelData[],
): { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number } | null {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let hasData = false;

  for (const ld of levels) {
    for (const fp of ld.footprints) {
      for (const v of fp.geometry.vertices) {
        minX = Math.min(minX, v.x_m);
        maxX = Math.max(maxX, v.x_m);
        minY = Math.min(minY, v.y_m);
        maxY = Math.max(maxY, v.y_m);
        hasData = true;
      }
    }
    minZ = Math.min(minZ, ld.level.elevation_m);
    for (const vol of ld.volumes) {
      maxZ = Math.max(maxZ, vol.base_elevation_m + vol.height_m);
    }
    if (ld.volumes.length === 0) {
      maxZ = Math.max(maxZ, ld.level.elevation_m);
    }
  }

  if (!hasData) return null;
  if (!isFinite(minZ)) minZ = 0;
  if (!isFinite(maxZ)) maxZ = 0;
  return { minX, maxX, minY, maxY, minZ, maxZ };
}

function computeIsoTransform(
  wb: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number },
  width: number,
  height: number,
  padding: number,
): { scale: number; offsetX: number; offsetY: number } {
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

function isoTx(
  x_m: number,
  y_m: number,
  z_m: number,
  t: { scale: number; offsetX: number; offsetY: number },
): IsoPoint {
  const raw = toIso(x_m, y_m, z_m, t.scale);
  return {
    x: roundSvg(raw.x + t.offsetX),
    y: roundSvg(raw.y + t.offsetY),
  };
}

function pointsStr(pts: readonly IsoPoint[]): string {
  return pts.map((p) => `${p.x},${p.y}`).join(' ');
}

function filterLevelData(
  site: SiteData,
  levelId: string,
): IsoLevelData | null {
  const level = site.levels.find((l) => l.id === levelId);
  if (!level) return null;
  const footprints = site.footprints.filter(
    (f) => f.level_id === levelId,
  );
  const fpIds = new Set(footprints.map((f) => f.id));
  const volumes = site.volumes.filter(
    (v) => fpIds.has(v.footprint_id),
  );
  const nodes = site.graph.nodes.filter(
    (n) => n.level_id === levelId,
  );
  return { level, footprints, volumes, nodes };
}

export function renderIsoView(
  site: SiteData,
  levelIds: readonly string[],
  options: IsoOptions,
): Outcome<string> {
  const warnings: Finding[] = [];

  const sortedIds = [...levelIds].sort();
  const levelDataList: IsoLevelData[] = [];
  for (const id of sortedIds) {
    const ld = filterLevelData(site, id);
    if (!ld) {
      return {
        ok: false,
        findings: [{
          code: 'ISO.LEVEL_NOT_FOUND',
          severity: 'blocking',
          entity: { kind: 'level', id },
          params: { level_id: id },
          ruleRef: null,
        }],
      };
    }
    levelDataList.push(ld);
  }

  levelDataList.sort(
    (a, b) => a.level.ordinal - b.level.ordinal
      || a.level.id.localeCompare(b.level.id),
  );

  const wb = computeWorldBounds(levelDataList);
  if (!wb) {
    warnings.push({
      code: 'ISO.EMPTY_LEVELS',
      severity: 'warning',
      entity: null,
      params: { level_count: levelIds.length },
      ruleRef: null,
    });
    const svg = [
      `<svg xmlns="http://www.w3.org/2000/svg"`,
      ` width="${options.width_px}" height="${options.height_px}"`,
      ` viewBox="0 0 ${options.width_px} ${options.height_px}">`,
      `<rect width="100%" height="100%"`,
      ` fill="${esc(options.theme.background)}" />`,
      `</svg>`,
    ].join('');
    return { ok: true, value: svg, warnings };
  }

  const t = computeIsoTransform(
    wb,
    options.width_px,
    options.height_px,
    options.padding_px,
  );

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg"` +
    ` width="${options.width_px}" height="${options.height_px}"` +
    ` viewBox="0 0 ${options.width_px} ${options.height_px}">`,
  );
  parts.push(
    `<rect width="100%" height="100%"` +
    ` fill="${esc(options.theme.background)}" />`,
  );

  for (const ld of levelDataList) {
    const sortedFp = [...ld.footprints].sort(
      (a, b) => a.id.localeCompare(b.id),
    );

    for (const fp of sortedFp) {
      const vol = ld.volumes.find((v) => v.footprint_id === fp.id);
      const baseZ = vol ? vol.base_elevation_m : ld.level.elevation_m;
      const topZ = vol ? vol.base_elevation_m + vol.height_m : ld.level.elevation_m;

      const topVerts = fp.geometry.vertices.map((v) =>
        isoTx(v.x_m, v.y_m, topZ, t),
      );
      parts.push(
        `<polygon points="${pointsStr(topVerts)}"` +
        ` fill="${esc(options.theme.floor_top)}"` +
        ` stroke="${esc(options.theme.floor_stroke)}"` +
        ` stroke-width="1" />`,
      );

      if (vol && vol.height_m > 0) {
        renderWalls(parts, fp.geometry.vertices, baseZ, topZ, t, options.theme);
      }
    }

    if (options.show_nodes) {
      const sortedNodes = [...ld.nodes].sort(
        (a, b) => a.id.localeCompare(b.id),
      );
      const nodeZ = ld.volumes.length > 0
        ? Math.max(
            ...ld.volumes.map((v) => v.base_elevation_m + v.height_m),
          )
        : ld.level.elevation_m;

      for (const n of sortedNodes) {
        const p = isoTx(n.position.x_m, n.position.y_m, nodeZ, t);
        parts.push(
          `<circle cx="${p.x}" cy="${p.y}" r="3"` +
          ` fill="${esc(options.theme.node_fill)}"` +
          ` stroke="${esc(options.theme.node_stroke)}"` +
          ` stroke-width="1" />`,
        );
      }
    }
  }

  parts.push('</svg>');
  return { ok: true, value: parts.join(''), warnings };
}

function renderWalls(
  parts: string[],
  vertices: readonly Point[],
  baseZ: number,
  topZ: number,
  t: { scale: number; offsetX: number; offsetY: number },
  theme: IsoTheme,
): void {
  const n = vertices.length;
  if (n < 2) return;

  for (let i = 0; i < n; i++) {
    const v0 = vertices[i];
    const v1 = vertices[(i + 1) % n];
    if (!v0 || !v1) continue;

    const topLeft = isoTx(v0.x_m, v0.y_m, topZ, t);
    const topRight = isoTx(v1.x_m, v1.y_m, topZ, t);
    const botRight = isoTx(v1.x_m, v1.y_m, baseZ, t);
    const botLeft = isoTx(v0.x_m, v0.y_m, baseZ, t);

    const dx = v1.x_m - v0.x_m;
    const dy = v1.y_m - v0.y_m;
    const normalX = -dy;
    const normalY = dx;

    const viewDir = toIso(normalX, normalY, 0, 1);
    if (viewDir.y >= 0) continue;

    const fill = normalX > 0
      ? theme.wall_front
      : theme.wall_side;

    parts.push(
      `<polygon points="${pointsStr([topLeft, topRight, botRight, botLeft])}"` +
      ` fill="${esc(fill)}"` +
      ` stroke="${esc(theme.wall_stroke)}"` +
      ` stroke-width="0.5" />`,
    );
  }
}
