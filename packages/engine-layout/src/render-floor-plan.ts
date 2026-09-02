import type {
  SiteData,
  GraphNode,
  Edge,
  Footprint,
  Destination,
  Point,
  Outcome,
  Finding,
} from '@azimut/core-model';
import { roundSvg } from '@azimut/core-model';

export type FloorPlanTheme = {
  readonly background: string;
  readonly footprint_fill: string;
  readonly footprint_stroke: string;
  readonly edge_stroke: string;
  readonly edge_evacuation_stroke: string;
  readonly node_fill: string;
  readonly node_stroke: string;
  readonly node_safety_fill: string;
  readonly text_primary: string;
  readonly text_secondary: string;
};

export type FloorPlanOptions = {
  readonly width_px: number;
  readonly height_px: number;
  readonly theme: FloorPlanTheme;
  readonly font_family: string;
  readonly show_destinations: boolean;
  readonly show_edges: boolean;
  readonly padding_px: number;
};

export type FloorPlanData = {
  readonly footprints: readonly Footprint[];
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly Edge[];
  readonly destinations: readonly Destination[];
};

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function computeBounds(
  footprints: readonly Footprint[],
  nodes: readonly GraphNode[],
): { min: Point; max: Point } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let hasPoints = false;

  for (const fp of footprints) {
    for (const v of fp.geometry.vertices) {
      minX = Math.min(minX, v.x_m);
      minY = Math.min(minY, v.y_m);
      maxX = Math.max(maxX, v.x_m);
      maxY = Math.max(maxY, v.y_m);
      hasPoints = true;
    }
  }

  for (const n of nodes) {
    minX = Math.min(minX, n.position.x_m);
    minY = Math.min(minY, n.position.y_m);
    maxX = Math.max(maxX, n.position.x_m);
    maxY = Math.max(maxY, n.position.y_m);
    hasPoints = true;
  }

  if (!hasPoints) return null;
  return {
    min: { x_m: minX, y_m: minY },
    max: { x_m: maxX, y_m: maxY },
  };
}

type Transform = {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
};

function computeTransform(
  bounds: { min: Point; max: Point },
  width: number,
  height: number,
  padding: number,
): Transform {
  const availW = width - 2 * padding;
  const availH = height - 2 * padding;
  const worldW = bounds.max.x_m - bounds.min.x_m;
  const worldH = bounds.max.y_m - bounds.min.y_m;

  const scaleX = worldW > 0 ? availW / worldW : 1;
  const scaleY = worldH > 0 ? availH / worldH : 1;
  const scale = Math.min(scaleX, scaleY);

  const usedW = worldW * scale;
  const usedH = worldH * scale;

  return {
    scale,
    offsetX: padding + (availW - usedW) / 2 - bounds.min.x_m * scale,
    offsetY: padding + (availH - usedH) / 2 - bounds.min.y_m * scale,
  };
}

function tx(p: Point, t: Transform): { x: number; y: number } {
  return {
    x: roundSvg(p.x_m * t.scale + t.offsetX),
    y: roundSvg(p.y_m * t.scale + t.offsetY),
  };
}

const SAFETY_KINDS = new Set([
  'emergency_exit',
  'security_post',
]);

function nodeRadius(kind: string): number {
  if (kind === 'entrance') return 6;
  if (kind === 'elevator' || kind === 'stair' || kind === 'escalator') return 5;
  if (SAFETY_KINDS.has(kind)) return 5;
  if (kind === 'destination_access') return 4;
  return 3;
}

function filterLevelData(
  site: SiteData,
  levelId: string,
): FloorPlanData {
  const footprints = site.footprints.filter(
    (f) => f.level_id === levelId,
  );
  const nodes = site.graph.nodes.filter(
    (n) => n.level_id === levelId,
  );
  const nodeIdSet = new Set(nodes.map((n) => n.id));
  const edges = site.graph.edges.filter(
    (e) => nodeIdSet.has(e.from_node_id) && nodeIdSet.has(e.to_node_id),
  );
  const destinations = site.destinations.filter(
    (d) => nodeIdSet.has(d.node_id),
  );
  return { footprints, nodes, edges, destinations };
}

export function renderFloorPlan(
  site: SiteData,
  levelId: string,
  options: FloorPlanOptions,
): Outcome<string> {
  const level = site.levels.find((l) => l.id === levelId);
  if (!level) {
    const f: Finding = {
      code: 'FLOOR_PLAN.LEVEL_NOT_FOUND',
      severity: 'blocking',
      entity: { kind: 'level', id: levelId },
      params: { level_id: levelId },
      ruleRef: null,
    };
    return { ok: false, findings: [f] };
  }

  const data = filterLevelData(site, levelId);
  const bounds = computeBounds(data.footprints, data.nodes);
  const warnings: Finding[] = [];

  if (!bounds) {
    warnings.push({
      code: 'FLOOR_PLAN.EMPTY_LEVEL',
      severity: 'warning',
      entity: { kind: 'level', id: levelId },
      params: { level_id: levelId },
      ruleRef: null,
    });
    const svg = [
      `<svg xmlns="http://www.w3.org/2000/svg"`,
      ` width="${options.width_px}" height="${options.height_px}"`,
      ` viewBox="0 0 ${options.width_px} ${options.height_px}">`,
      `<rect width="100%" height="100%"`,
      ` fill="${esc(options.theme.background)}" />`,
      `<text x="${options.width_px / 2}" y="${options.height_px / 2}"`,
      ` text-anchor="middle" dominant-baseline="central"`,
      ` font-family="${esc(options.font_family)}" font-size="14"`,
      ` fill="${esc(options.theme.text_secondary)}">`,
      `${esc(level.name)} — aucun élément</text>`,
      `</svg>`,
    ].join('');
    return { ok: true, value: svg, warnings };
  }

  const t = computeTransform(
    bounds,
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

  const sortedFootprints = [...data.footprints].sort(
    (a, b) => a.id.localeCompare(b.id),
  );
  for (const fp of sortedFootprints) {
    const points = fp.geometry.vertices
      .map((v) => {
        const p = tx(v, t);
        return `${p.x},${p.y}`;
      })
      .join(' ');
    parts.push(
      `<polygon points="${points}"` +
      ` fill="${esc(options.theme.footprint_fill)}"` +
      ` stroke="${esc(options.theme.footprint_stroke)}"` +
      ` stroke-width="1" />`,
    );
  }

  if (options.show_edges) {
    const nodeMap = new Map(data.nodes.map((n) => [n.id, n]));
    const sortedEdges = [...data.edges].sort(
      (a, b) => a.id.localeCompare(b.id),
    );
    for (const e of sortedEdges) {
      const from = nodeMap.get(e.from_node_id);
      const to = nodeMap.get(e.to_node_id);
      if (!from || !to) continue;
      const p1 = tx(from.position, t);
      const p2 = tx(to.position, t);
      const stroke = e.evacuation_route
        ? options.theme.edge_evacuation_stroke
        : options.theme.edge_stroke;
      const dashArray = e.evacuation_route
        ? ' stroke-dasharray="6 3"'
        : '';
      parts.push(
        `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}"` +
        ` stroke="${esc(stroke)}" stroke-width="1.5"${dashArray} />`,
      );
    }
  }

  const sortedNodes = [...data.nodes].sort(
    (a, b) => a.id.localeCompare(b.id),
  );
  for (const n of sortedNodes) {
    const p = tx(n.position, t);
    const r = nodeRadius(n.kind);
    const fill = SAFETY_KINDS.has(n.kind)
      ? options.theme.node_safety_fill
      : options.theme.node_fill;
    parts.push(
      `<circle cx="${p.x}" cy="${p.y}" r="${r}"` +
      ` fill="${esc(fill)}"` +
      ` stroke="${esc(options.theme.node_stroke)}"` +
      ` stroke-width="1" />`,
    );
  }

  if (options.show_destinations) {
    const sortedDests = [...data.destinations].sort(
      (a, b) => a.display_priority - b.display_priority
        || a.id.localeCompare(b.id),
    );
    for (const d of sortedDests) {
      const node = data.nodes.find((n) => n.id === d.node_id);
      if (!node) continue;
      const p = tx(node.position, t);
      parts.push(
        `<text x="${p.x}" y="${p.y - 8}"` +
        ` text-anchor="middle" font-size="10"` +
        ` font-family="${esc(options.font_family)}"` +
        ` fill="${esc(options.theme.text_primary)}">` +
        `${esc(d.occupant_name)}</text>`,
      );
    }
  }

  parts.push('</svg>');

  return { ok: true, value: parts.join(''), warnings };
}
