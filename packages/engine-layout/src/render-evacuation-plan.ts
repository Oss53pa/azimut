import type {
  SiteData,
  Point,
  Outcome,
  Finding,
} from '@azimut/core-model';

export type EvacuationTheme = {
  readonly background: string;
  readonly footprint_fill: string;
  readonly footprint_stroke: string;
  readonly route_stroke: string;
  readonly route_arrow: string;
  readonly non_route_stroke: string;
  readonly exit_fill: string;
  readonly exit_stroke: string;
  readonly assembly_fill: string;
  readonly assembly_stroke: string;
  readonly node_fill: string;
  readonly node_stroke: string;
  readonly text_primary: string;
  readonly text_secondary: string;
  readonly marker_fill: string;
  readonly marker_stroke: string;
};

export type EvacuationPlanOptions = {
  readonly width_px: number;
  readonly height_px: number;
  readonly theme: EvacuationTheme;
  readonly font_family: string;
  readonly padding_px: number;
  readonly viewer_position: Point | null;
  readonly show_non_evacuation: boolean;
};

export type EvacuationStats = {
  readonly exit_count: number;
  readonly route_count: number;
  readonly total_route_length_m: number;
};

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type Transform = {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
};

function computeBounds(
  points: readonly Point[],
): { min: Point; max: Point } | null {
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
    x: Math.round((p.x_m * t.scale + t.offsetX) * 100) / 100,
    y: Math.round((p.y_m * t.scale + t.offsetY) * 100) / 100,
  };
}

const EXIT_KINDS = new Set(['emergency_exit', 'entrance']);

export function renderEvacuationPlan(
  site: SiteData,
  levelId: string,
  options: EvacuationPlanOptions,
): Outcome<{ svg: string; stats: EvacuationStats }> {
  const level = site.levels.find((l) => l.id === levelId);
  if (!level) {
    return {
      ok: false,
      findings: [{
        code: 'EVAC.LEVEL_NOT_FOUND',
        severity: 'blocking',
        entity: { kind: 'level', id: levelId },
        params: { level_id: levelId },
        ruleRef: null,
      }],
    };
  }

  const warnings: Finding[] = [];

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

  const allPoints: Point[] = [];
  for (const fp of footprints) {
    for (const v of fp.geometry.vertices) {
      allPoints.push(v);
    }
  }
  for (const n of nodes) {
    allPoints.push(n.position);
  }
  if (options.viewer_position) {
    allPoints.push(options.viewer_position);
  }

  const bounds = computeBounds(allPoints);
  if (!bounds) {
    warnings.push({
      code: 'EVAC.EMPTY_LEVEL',
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
    return {
      ok: true,
      value: {
        svg,
        stats: { exit_count: 0, route_count: 0, total_route_length_m: 0 },
      },
      warnings,
    };
  }

  const t = computeTransform(
    bounds,
    options.width_px,
    options.height_px,
    options.padding_px,
  );

  const evacRoutes = edges.filter((e) => e.evacuation_route);
  const nonEvacRoutes = edges.filter((e) => !e.evacuation_route);
  const exits = nodes.filter((n) => EXIT_KINDS.has(n.kind));

  if (evacRoutes.length === 0) {
    warnings.push({
      code: 'EVAC.NO_ROUTES',
      severity: 'warning',
      entity: { kind: 'level', id: levelId },
      params: { level_id: levelId },
      ruleRef: null,
    });
  }

  if (exits.length === 0) {
    warnings.push({
      code: 'EVAC.NO_EXITS',
      severity: 'warning',
      entity: { kind: 'level', id: levelId },
      params: { level_id: levelId },
      ruleRef: null,
    });
  }

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

  const sortedFp = [...footprints].sort(
    (a, b) => a.id.localeCompare(b.id),
  );
  for (const fp of sortedFp) {
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

  if (options.show_non_evacuation) {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const sortedNonEvac = [...nonEvacRoutes].sort(
      (a, b) => a.id.localeCompare(b.id),
    );
    for (const e of sortedNonEvac) {
      const from = nodeMap.get(e.from_node_id);
      const to = nodeMap.get(e.to_node_id);
      if (!from || !to) continue;
      const p1 = tx(from.position, t);
      const p2 = tx(to.position, t);
      parts.push(
        `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}"` +
        ` stroke="${esc(options.theme.non_route_stroke)}"` +
        ` stroke-width="1" stroke-dasharray="2 4" opacity="0.4" />`,
      );
    }
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const sortedEvac = [...evacRoutes].sort(
    (a, b) => a.id.localeCompare(b.id),
  );
  for (const e of sortedEvac) {
    const from = nodeMap.get(e.from_node_id);
    const to = nodeMap.get(e.to_node_id);
    if (!from || !to) continue;
    const p1 = tx(from.position, t);
    const p2 = tx(to.position, t);
    parts.push(
      `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}"` +
      ` stroke="${esc(options.theme.route_stroke)}"` +
      ` stroke-width="3" />`,
    );

    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      const ux = dx / len;
      const uy = dy / len;
      const aSize = 5;
      const ax1 = Math.round((mx - ux * aSize + uy * aSize) * 100) / 100;
      const ay1 = Math.round((my - uy * aSize - ux * aSize) * 100) / 100;
      const ax2 = Math.round((mx - ux * aSize - uy * aSize) * 100) / 100;
      const ay2 = Math.round((my - uy * aSize + ux * aSize) * 100) / 100;
      parts.push(
        `<polygon points="${Math.round(mx * 100) / 100},` +
        `${Math.round(my * 100) / 100} ${ax1},${ay1} ${ax2},${ay2}"` +
        ` fill="${esc(options.theme.route_arrow)}" />`,
      );
    }
  }

  const sortedExits = [...exits].sort(
    (a, b) => a.id.localeCompare(b.id),
  );
  for (const ex of sortedExits) {
    const p = tx(ex.position, t);
    parts.push(
      `<rect x="${p.x - 8}" y="${p.y - 8}" width="16" height="16"` +
      ` fill="${esc(options.theme.exit_fill)}"` +
      ` stroke="${esc(options.theme.exit_stroke)}"` +
      ` stroke-width="2" />`,
    );
    parts.push(
      `<text x="${p.x}" y="${p.y + 4}"` +
      ` text-anchor="middle" font-size="10" font-weight="bold"` +
      ` font-family="${esc(options.font_family)}"` +
      ` fill="${esc(options.theme.exit_stroke)}">` +
      `${esc(ex.label)}</text>`,
    );
  }

  const nonExitNodes = nodes.filter((n) => !EXIT_KINDS.has(n.kind));
  const sortedNonExit = [...nonExitNodes].sort(
    (a, b) => a.id.localeCompare(b.id),
  );
  for (const n of sortedNonExit) {
    const p = tx(n.position, t);
    parts.push(
      `<circle cx="${p.x}" cy="${p.y}" r="3"` +
      ` fill="${esc(options.theme.node_fill)}"` +
      ` stroke="${esc(options.theme.node_stroke)}"` +
      ` stroke-width="1" />`,
    );
  }

  if (options.viewer_position) {
    const vp = tx(options.viewer_position, t);
    parts.push(
      `<circle cx="${vp.x}" cy="${vp.y}" r="8"` +
      ` fill="${esc(options.theme.marker_fill)}"` +
      ` stroke="${esc(options.theme.marker_stroke)}"` +
      ` stroke-width="2" />`,
    );
    parts.push(
      `<text x="${vp.x}" y="${vp.y + 4}"` +
      ` text-anchor="middle" font-size="10" font-weight="bold"` +
      ` font-family="${esc(options.font_family)}"` +
      ` fill="${esc(options.theme.marker_stroke)}">` +
      `&#x25B2;</text>`,
    );
  }

  parts.push(
    `<text x="${options.padding_px}" y="${options.height_px - options.padding_px}"` +
    ` font-size="12" font-weight="bold"` +
    ` font-family="${esc(options.font_family)}"` +
    ` fill="${esc(options.theme.text_primary)}">` +
    `PLAN D&#x27;&#xC9;VACUATION &#x2014; ${esc(level.name)}</text>`,
  );

  parts.push('</svg>');

  let totalLength = 0;
  for (const e of evacRoutes) {
    totalLength += e.length_m;
  }

  const stats: EvacuationStats = {
    exit_count: exits.length,
    route_count: evacRoutes.length,
    total_route_length_m: Math.round(totalLength * 100) / 100,
  };

  return { ok: true, value: { svg: parts.join(''), stats }, warnings };
}
