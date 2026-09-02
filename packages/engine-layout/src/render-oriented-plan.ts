import type {
  SiteData,
  Point,
  Outcome,
  Finding,
} from '@azimut/core-model';

export type OrientedPlanTheme = {
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
  readonly marker_fill: string;
  readonly marker_stroke: string;
};

export type OrientedPlanOptions = {
  readonly width_px: number;
  readonly height_px: number;
  readonly theme: OrientedPlanTheme;
  readonly font_family: string;
  readonly show_destinations: boolean;
  readonly show_edges: boolean;
  readonly padding_px: number;
  readonly orientation_deg: number;
  readonly viewer_position: Point;
  readonly show_north_arrow: boolean;
};

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function rotatePoint(
  p: Point,
  center: Point,
  angleDeg: number,
): Point {
  const rad = degToRad(-angleDeg);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x_m - center.x_m;
  const dy = p.y_m - center.y_m;
  return {
    x_m: center.x_m + dx * cos - dy * sin,
    y_m: center.y_m + dx * sin + dy * cos,
  };
}

type Bounds = { min: Point; max: Point };

function computeBounds(points: readonly Point[]): Bounds | null {
  if (points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x_m);
    minY = Math.min(minY, p.y_m);
    maxX = Math.max(maxX, p.x_m);
    maxY = Math.max(maxY, p.y_m);
  }
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
  bounds: Bounds,
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
    x: Math.round((p.x_m * t.scale + t.offsetX) * 100) / 100,
    y: Math.round((p.y_m * t.scale + t.offsetY) * 100) / 100,
  };
}

const SAFETY_KINDS = new Set(['emergency_exit', 'security_post']);

function nodeRadius(kind: string): number {
  if (kind === 'entrance') return 6;
  if (kind === 'elevator' || kind === 'stair' || kind === 'escalator') return 5;
  if (SAFETY_KINDS.has(kind)) return 5;
  if (kind === 'destination_access') return 4;
  return 3;
}

export function renderOrientedPlan(
  site: SiteData,
  levelId: string,
  options: OrientedPlanOptions,
): Outcome<string> {
  const level = site.levels.find((l) => l.id === levelId);
  if (!level) {
    const f: Finding = {
      code: 'ORIENTED_PLAN.LEVEL_NOT_FOUND',
      severity: 'blocking',
      entity: { kind: 'level', id: levelId },
      params: { level_id: levelId },
      ruleRef: null,
    };
    return { ok: false, findings: [f] };
  }

  const warnings: Finding[] = [];
  const rot = options.orientation_deg;
  const center = options.viewer_position;

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

  const allRotated: Point[] = [];
  const rotatedFootprints = footprints.map((fp) => {
    const verts = fp.geometry.vertices.map((v) =>
      rotatePoint(v, center, rot),
    );
    allRotated.push(...verts);
    return { id: fp.id, vertices: verts, kind: fp.kind };
  });

  const rotatedNodes = nodes.map((n) => {
    const rp = rotatePoint(n.position, center, rot);
    allRotated.push(rp);
    return { ...n, position: rp };
  });

  const rotatedViewer = rotatePoint(center, center, rot);
  allRotated.push(rotatedViewer);

  const bounds = computeBounds(allRotated);
  if (!bounds) {
    warnings.push({
      code: 'ORIENTED_PLAN.EMPTY_LEVEL',
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

  const sortedFp = [...rotatedFootprints].sort(
    (a, b) => a.id.localeCompare(b.id),
  );
  for (const fp of sortedFp) {
    const points = fp.vertices
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
    const rnMap = new Map(
      rotatedNodes.map((n) => [n.id, n]),
    );
    const sortedEdges = [...edges].sort(
      (a, b) => a.id.localeCompare(b.id),
    );
    for (const e of sortedEdges) {
      const from = rnMap.get(e.from_node_id);
      const to = rnMap.get(e.to_node_id);
      if (!from || !to) continue;
      const p1 = tx(from.position, t);
      const p2 = tx(to.position, t);
      const stroke = e.evacuation_route
        ? options.theme.edge_evacuation_stroke
        : options.theme.edge_stroke;
      const dash = e.evacuation_route ? ' stroke-dasharray="6 3"' : '';
      parts.push(
        `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}"` +
        ` stroke="${esc(stroke)}" stroke-width="1.5"${dash} />`,
      );
    }
  }

  const sortedNodes = [...rotatedNodes].sort(
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
    const sortedDests = [...destinations].sort(
      (a, b) =>
        a.display_priority - b.display_priority
        || a.id.localeCompare(b.id),
    );
    for (const d of sortedDests) {
      const rn = rotatedNodes.find((n) => n.id === d.node_id);
      if (!rn) continue;
      const p = tx(rn.position, t);
      parts.push(
        `<text x="${p.x}" y="${p.y - 8}"` +
        ` text-anchor="middle" font-size="10"` +
        ` font-family="${esc(options.font_family)}"` +
        ` fill="${esc(options.theme.text_primary)}">` +
        `${esc(d.occupant_name)}</text>`,
      );
    }
  }

  const vp = tx(rotatedViewer, t);
  parts.push(
    `<circle cx="${vp.x}" cy="${vp.y}" r="8"` +
    ` fill="${esc(options.theme.marker_fill)}"` +
    ` stroke="${esc(options.theme.marker_stroke)}"` +
    ` stroke-width="2" />`,
  );
  parts.push(
    `<text x="${vp.x}" y="${vp.y + 4}"` +
    ` text-anchor="middle" font-size="10"` +
    ` font-weight="bold"` +
    ` font-family="${esc(options.font_family)}"` +
    ` fill="${esc(options.theme.marker_stroke)}">` +
    `&#x25B2;</text>`,
  );

  if (options.show_north_arrow) {
    const arrowX = options.width_px - options.padding_px - 15;
    const arrowY = options.padding_px + 15;
    const northRad = degToRad(rot);
    const northDx = Math.round(Math.sin(northRad) * 12 * 100) / 100;
    const northDy = Math.round(-Math.cos(northRad) * 12 * 100) / 100;
    parts.push(
      `<line x1="${arrowX}" y1="${arrowY}"` +
      ` x2="${Math.round((arrowX + northDx) * 100) / 100}"` +
      ` y2="${Math.round((arrowY + northDy) * 100) / 100}"` +
      ` stroke="${esc(options.theme.text_primary)}"` +
      ` stroke-width="2" />`,
    );
    parts.push(
      `<text x="${Math.round((arrowX + northDx * 1.5) * 100) / 100}"` +
      ` y="${Math.round((arrowY + northDy * 1.5) * 100) / 100}"` +
      ` text-anchor="middle" dominant-baseline="central"` +
      ` font-size="10" font-weight="bold"` +
      ` font-family="${esc(options.font_family)}"` +
      ` fill="${esc(options.theme.text_primary)}">N</text>`,
    );
  }

  parts.push('</svg>');
  return { ok: true, value: parts.join(''), warnings };
}
