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
import {
  type IsoTransform,
  type LevelGeom,
  toIso,
  isoTx,
  pointsStr,
  esc,
  computeWorldBounds,
  computeIsoTransform,
} from './projection.js';
import { sortVolumesPainter, detectOverlaps } from './painter-sort.js';
import type { VolumeEntry } from './painter-sort.js';
import { extractHitZones } from './hit-zones.js';
import type { HitZone } from './hit-zones.js';

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

export type IsoMultiLevelMode =
  | { readonly kind: 'all' }
  | { readonly kind: 'active_level'; readonly active_level_id: string; readonly adjacent_opacity: number }
  | { readonly kind: 'exploded'; readonly offset_m: number };

export type IsoOptions = {
  readonly width_px: number;
  readonly height_px: number;
  readonly theme: IsoTheme;
  readonly font_family: string;
  readonly padding_px: number;
  readonly show_nodes: boolean;
  readonly mode: IsoMultiLevelMode;
};

export type IsoLevelData = {
  readonly level: Level;
  readonly footprints: readonly Footprint[];
  readonly volumes: readonly Volume[];
  readonly nodes: readonly GraphNode[];
};

export type IsoResult = {
  readonly svg: string;
  readonly hitZones: readonly HitZone[];
};

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

function explodedZ(
  baseZ: number,
  ordinal: number,
  minOrdinal: number,
  offset_m: number,
): number {
  return baseZ + (ordinal - minOrdinal) * offset_m;
}

function levelGeom(ld: IsoLevelData): LevelGeom {
  const allVerts: Point[] = [];
  for (const fp of ld.footprints) {
    for (const v of fp.geometry.vertices) {
      allVerts.push(v);
    }
  }
  const maxZ = ld.volumes.length > 0
    ? Math.max(...ld.volumes.map((v) => v.base_elevation_m + v.height_m))
    : ld.level.elevation_m;
  return { vertices: allVerts, elevation_m: ld.level.elevation_m, maxZ };
}

function renderWalls(
  parts: string[],
  vertices: readonly Point[],
  baseZ: number,
  topZ: number,
  t: IsoTransform,
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

function renderLevelContent(
  parts: string[],
  ld: IsoLevelData,
  t: IsoTransform,
  theme: IsoTheme,
  showNodes: boolean,
  zOffset: number,
): VolumeEntry[] {
  const volByFp = new Map<string, Volume>();
  for (const vol of ld.volumes) {
    volByFp.set(vol.footprint_id, vol);
  }

  const entries: VolumeEntry[] = [];
  const bareFps: Footprint[] = [];
  for (const fp of ld.footprints) {
    const vol = volByFp.get(fp.id);
    if (vol) {
      entries.push({ volume: vol, footprint: fp });
    } else {
      bareFps.push(fp);
    }
  }

  const sortedBare = [...bareFps].sort((a, b) => a.id.localeCompare(b.id));
  for (const fp of sortedBare) {
    const z = ld.level.elevation_m + zOffset;
    const verts = fp.geometry.vertices.map((v) => isoTx(v.x_m, v.y_m, z, t));
    parts.push(
      `<polygon points="${pointsStr(verts)}"` +
      ` fill="${esc(theme.floor_top)}"` +
      ` stroke="${esc(theme.floor_stroke)}"` +
      ` stroke-width="1" />`,
    );
  }

  const sorted = sortVolumesPainter(entries);

  for (const entry of sorted) {
    const baseZ = entry.volume.base_elevation_m + zOffset;
    const topZ = baseZ + entry.volume.height_m;
    const verts = entry.footprint.geometry.vertices;

    const topVerts = verts.map((v) => isoTx(v.x_m, v.y_m, topZ, t));
    parts.push(
      `<polygon points="${pointsStr(topVerts)}"` +
      ` fill="${esc(theme.floor_top)}"` +
      ` stroke="${esc(theme.floor_stroke)}"` +
      ` stroke-width="1" />`,
    );

    if (entry.volume.height_m > 0) {
      renderWalls(parts, verts, baseZ, topZ, t, theme);
    }
  }

  if (showNodes) {
    const sortedNodes = [...ld.nodes].sort(
      (a, b) => a.id.localeCompare(b.id),
    );
    const nodeZ = ld.volumes.length > 0
      ? Math.max(
          ...ld.volumes.map((v) => v.base_elevation_m + v.height_m),
        ) + zOffset
      : ld.level.elevation_m + zOffset;

    for (const n of sortedNodes) {
      const p = isoTx(n.position.x_m, n.position.y_m, nodeZ, t);
      parts.push(
        `<circle cx="${p.x}" cy="${p.y}" r="3"` +
        ` fill="${esc(theme.node_fill)}"` +
        ` stroke="${esc(theme.node_stroke)}"` +
        ` stroke-width="1" />`,
      );
    }
  }

  return [...sorted];
}

export function renderIsoView(
  site: SiteData,
  levelIds: readonly string[],
  options: IsoOptions,
): Outcome<IsoResult> {
  const warnings: Finding[] = [];

  const sortedIds = [...levelIds].sort();
  const levelDataList: IsoLevelData[] = [];
  for (const id of sortedIds) {
    const ld = filterLevelData(site, id);
    if (!ld) {
      return {
        ok: false,
        findings: [{
          code: 'LAYOUT.ISO_LEVEL_NOT_FOUND',
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

  for (const ld of levelDataList) {
    const overlaps = detectOverlaps(ld.footprints);
    for (const f of overlaps) warnings.push(f);
  }

  const minOrdinal = levelDataList.length > 0
    ? Math.min(...levelDataList.map((ld) => ld.level.ordinal))
    : 0;

  const geoms: LevelGeom[] = levelDataList.map((ld) => {
    const g = levelGeom(ld);
    if (options.mode.kind === 'exploded') {
      const off = explodedZ(0, ld.level.ordinal, minOrdinal, options.mode.offset_m);
      return { ...g, elevation_m: g.elevation_m + off, maxZ: g.maxZ + off };
    }
    return g;
  });

  const wb = computeWorldBounds(geoms);
  if (!wb) {
    warnings.push({
      code: 'LAYOUT.ISO_EMPTY_LEVELS',
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
    return { ok: true, value: { svg, hitZones: [] }, warnings };
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

  const allEntries: VolumeEntry[] = [];

  for (const ld of levelDataList) {
    const zOffset = options.mode.kind === 'exploded'
      ? explodedZ(0, ld.level.ordinal, minOrdinal, options.mode.offset_m)
      : 0;

    const isActive = options.mode.kind !== 'active_level'
      || ld.level.id === options.mode.active_level_id;

    const opacity = isActive
      ? 1
      : (options.mode.kind === 'active_level' ? options.mode.adjacent_opacity : 1);

    if (opacity < 1) {
      parts.push(`<g opacity="${opacity}">`);
    }

    const entries = renderLevelContent(
      parts, ld, t, options.theme, options.show_nodes, zOffset,
    );
    allEntries.push(...entries);

    if (opacity < 1) {
      parts.push('</g>');
    }
  }

  parts.push('</svg>');

  const hitZones = extractHitZones(allEntries, t);

  return { ok: true, value: { svg: parts.join(''), hitZones }, warnings };
}
