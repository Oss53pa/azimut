import type { Footprint, GraphNode, Level, Outcome, Point } from '@azimut/core-model';
import { codePointCompare, formatSvg, orientForDisplay } from '@azimut/core-model';

/**
 * A7.3 et L3.1 — `renderRouteAnimation(route, scene)` : le parcours animé.
 *
 * « Tracé progressif, mise en évidence des points de décision, transition
 * explicite au changement de niveau, équivalent statique pour l'impression et
 * le mode à animation réduite. »
 *
 * Le parcours est découpé en tronçons, un par niveau traversé, dans l'ordre du
 * chemin. Chaque tronçon donne deux rendus du même plan : l'animé, où le tracé
 * avance et où chaque point de décision apparaît quand le tracé l'atteint, et
 * le statique, où tout est posé d'emblée. Le passage d'un tronçon au suivant
 * est un changement de niveau, rendu à part : c'est la « transition
 * explicite » de L3.1, que l'interface dit avec ses mots.
 *
 * Aucun texte dans le rendu (A7) : les marques portent leur rôle en attribut,
 * l'interface les nomme. Aucune vitesse de marche (INV-5) : la durée est celle
 * de l'animation, réglée par l'appelant, et répartie au prorata des longueurs.
 * Déterministe (INV-4) : même parcours, même scène, mêmes options, mêmes
 * octets.
 *
 * Sans orientation, le plan est vu nord en haut. Avec une orientation, il est
 * tourné selon D6.2, comme le plan mural : c'est le plan orienté de la borne
 * (D10.3, partie P, écran Itinéraire), où ce que le visiteur regarde est en
 * haut. Le rendu ne résout aucune fonction de pictogramme (A5.8) : la borne
 * peut le composer à l'exécution.
 */
export type RouteForAnimation = {
  readonly path: readonly string[];
};

/** Ce que le rendu lit du site : les nœuds, les niveaux, les empreintes en fond. */
export type RouteScene = {
  readonly nodes: readonly GraphNode[];
  readonly levels: readonly Level[];
  readonly footprints: readonly Footprint[];
};

export type RouteAnimationTheme = {
  readonly background: string;
  readonly footprint_fill: string;
  readonly footprint_stroke: string;
  readonly route: string;
  readonly marker: string;
  readonly marker_fill: string;
};

/** D6.2 — la rotation d'affichage et son centre, la position de l'usager. */
export type RouteOrientation = {
  readonly center: Point;
  /** La valeur rendue par `orientationDegForAzimuth`, jamais l'azimut brut. */
  readonly orientation_deg: number;
};

export type RouteAnimationOptions = {
  readonly width_px: number;
  readonly height_px: number;
  readonly padding_px: number;
  readonly stroke_px: number;
  readonly marker_px: number;
  /** Durée totale du tracé, en secondes, répartie entre les tronçons. */
  readonly duration_s: number;
  readonly theme: RouteAnimationTheme;
  /** Absente : nord en haut. */
  readonly orientation?: RouteOrientation;
};

export type RouteMarkerRole = 'start' | 'end' | 'decision' | 'level_exit' | 'level_entry';

export type RouteLevelFrame = {
  readonly level_id: string;
  /** Les nœuds du chemin sur ce niveau, dans l'ordre. */
  readonly node_ids: readonly string[];
  readonly decision_node_ids: readonly string[];
  readonly length_m: number;
  /** Instant de départ et durée de ce tronçon dans l'animation entière. */
  readonly begin_s: number;
  readonly dur_s: number;
  readonly svg: string;
  readonly static_svg: string;
};

export type RouteLevelChange = {
  readonly from_level_id: string;
  readonly to_level_id: string;
  /** Le nœud quitté et le nœud atteint : leur type dit le moyen (ascenseur, escalier…). */
  readonly exit_node_id: string;
  readonly entry_node_id: string;
};

export type RouteAnimation = {
  readonly frames: readonly RouteLevelFrame[];
  readonly level_changes: readonly RouteLevelChange[];
};

type Run = { readonly level_id: string; readonly nodes: readonly GraphNode[] };

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x_m - a.x_m, b.y_m - a.y_m);
}

function runsOf(nodes: readonly GraphNode[]): readonly Run[] {
  const runs: { level_id: string; nodes: GraphNode[] }[] = [];
  for (const node of nodes) {
    const last = runs[runs.length - 1];
    if (last !== undefined && last.level_id === node.level_id) last.nodes.push(node);
    else runs.push({ level_id: node.level_id, nodes: [node] });
  }
  return runs;
}

type Projector = (p: Point) => { readonly x: string; readonly y: string; readonly xn: number; readonly yn: number };

const ORIGIN: Point = { x_m: 0, y_m: 0 };

/**
 * Plan vu de dessus. Les points passent d'abord dans le repère d'affichage de
 * D6.2, où l'axe des y descend comme celui de l'écran ; sans orientation, la
 * rotation est nulle et le plan est vu nord en haut.
 */
function projector(points: readonly Point[], options: RouteAnimationOptions): Projector {
  const center = options.orientation?.center ?? ORIGIN;
  const deg = options.orientation?.orientation_deg ?? 0;
  const shown = (p: Point): Point => orientForDisplay(p, center, deg);
  const turned = points.map(shown);
  const xs = turned.map(p => p.x_m);
  const ys = turned.map(p => p.y_m);
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1e-9);
  const spanY = Math.max(maxY - minY, 1e-9);
  const innerW = options.width_px - 2 * options.padding_px;
  const innerH = options.height_px - 2 * options.padding_px;
  const scale = Math.min(innerW / spanX, innerH / spanY);
  const offX = options.padding_px + (innerW - spanX * scale) / 2;
  const offY = options.padding_px + (innerH - spanY * scale) / 2;
  return p => {
    const q = shown(p);
    const xn = offX + (q.x_m - minX) * scale;
    const yn = offY + (q.y_m - minY) * scale;
    return { x: formatSvg(xn), y: formatSvg(yn), xn, yn };
  };
}

function marker(role: RouteMarkerRole, nodeId: string, at: { x: string; y: string }, options: RouteAnimationOptions, appear: string): string {
  const r = formatSvg(options.marker_px / 2);
  const side = formatSvg(options.marker_px);
  // Le point de décision est plein ; les autres marques sont évidées.
  const fill = role === 'decision' ? options.theme.marker : options.theme.marker_fill;
  const common = `data-role="${role}" data-node="${nodeId}" fill="${fill}" stroke="${options.theme.marker}" stroke-width="${formatSvg(options.stroke_px / 2)}"`;
  // Les formes portent le rôle sans la couleur (E6.3) : départ rond, arrivée
  // carrée, décision ronde pleine, changement de niveau en losange.
  const half = options.marker_px / 2;
  const x = Number(at.x); const y = Number(at.y);
  switch (role) {
    case 'start':
    case 'decision':
      return `<circle ${common} cx="${at.x}" cy="${at.y}" r="${r}">${appear}</circle>`;
    case 'end':
      return `<rect ${common} x="${formatSvg(x - half)}" y="${formatSvg(y - half)}" width="${side}" height="${side}">${appear}</rect>`;
    case 'level_exit':
    case 'level_entry':
      return `<polygon ${common} points="${formatSvg(x)},${formatSvg(y - half)} ${formatSvg(x + half)},${formatSvg(y)} ${formatSvg(x)},${formatSvg(y + half)} ${formatSvg(x - half)},${formatSvg(y)}">${appear}</polygon>`;
  }
}

function frameSvg(
  run: Run, roles: ReadonlyMap<string, RouteMarkerRole>, footprints: readonly Footprint[],
  options: RouteAnimationOptions, dur_s: number | null,
): string {
  const levelPrints = footprints.filter(f => f.level_id === run.level_id);
  const project = projector(
    [...levelPrints.flatMap(f => f.geometry.vertices), ...run.nodes.map(n => n.position)], options,
  );
  const at = run.nodes.map(n => project(n.position));
  let lengthPx = 0;
  const reachedPx: number[] = [0];
  for (let i = 1; i < at.length; i++) {
    const a = at[i - 1]; const b = at[i];
    if (a !== undefined && b !== undefined) lengthPx += Math.hypot(b.xn - a.xn, b.yn - a.yn);
    reachedPx.push(lengthPx);
  }
  const theme = options.theme;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${formatSvg(options.width_px)} ${formatSvg(options.height_px)}" width="${formatSvg(options.width_px)}" height="${formatSvg(options.height_px)}" data-level="${run.level_id}">`,
    `<rect width="100%" height="100%" fill="${theme.background}"/>`,
  ];
  for (const print of [...levelPrints].sort((a, b) => codePointCompare(a.id, b.id))) {
    const pts = print.geometry.vertices.map(v => { const p = project(v); return `${p.x},${p.y}`; }).join(' ');
    parts.push(`<polygon points="${pts}" fill="${theme.footprint_fill}" stroke="${theme.footprint_stroke}" stroke-width="1"/>`);
  }
  const line = at.map(p => `${p.x},${p.y}`).join(' ');
  const len = formatSvg(lengthPx);
  if (dur_s === null || at.length < 2) {
    parts.push(`<polyline data-role="route" points="${line}" fill="none" stroke="${theme.route}" stroke-width="${formatSvg(options.stroke_px)}" stroke-linecap="round" stroke-linejoin="round"/>`);
  } else {
    parts.push(
      `<polyline data-role="route" points="${line}" fill="none" stroke="${theme.route}" stroke-width="${formatSvg(options.stroke_px)}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${len}" stroke-dashoffset="${len}">`
      + `<animate attributeName="stroke-dashoffset" from="${len}" to="0" dur="${formatSvg(dur_s)}s" fill="freeze"/></polyline>`,
    );
  }
  run.nodes.forEach((node, i) => {
    const role = roles.get(node.id);
    const p = at[i];
    if (role === undefined || p === undefined) return;
    // Dans l'animé, la marque apparaît quand le tracé l'atteint.
    const appear = dur_s === null || lengthPx === 0
      ? ''
      : `<set attributeName="visibility" to="visible" begin="${formatSvg(dur_s * ((reachedPx[i] ?? 0) / lengthPx))}s"/>`;
    const hidden = appear === '' ? '' : ' visibility="hidden"';
    parts.push(marker(role, node.id, p, options, appear).replace(/^<(\w+) /, `<$1${hidden} `));
  });
  parts.push('</svg>');
  return parts.join('');
}

export function renderRouteAnimation(
  route: RouteForAnimation,
  scene: RouteScene,
  decisionNodeIds: readonly string[],
  options: RouteAnimationOptions,
): Outcome<RouteAnimation> {
  const byId = new Map(scene.nodes.map(n => [n.id, n]));
  const nodes: GraphNode[] = [];
  for (const id of route.path) {
    const node = byId.get(id);
    if (node === undefined) {
      return {
        ok: false,
        findings: [{
          code: 'GRAPH.ROUTE_NODE_NOT_FOUND', severity: 'blocking',
          entity: { kind: 'node', id }, params: { node_id: id }, ruleRef: 'A7.3',
        }],
      };
    }
    nodes.push(node);
  }

  const runs = runsOf(nodes);
  const decisions = new Set(decisionNodeIds);
  const roles = new Map<string, RouteMarkerRole>();
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  runs.forEach((run, i) => {
    const head = run.nodes[0];
    const tail = run.nodes[run.nodes.length - 1];
    if (i > 0 && head !== undefined) roles.set(head.id, 'level_entry');
    if (i < runs.length - 1 && tail !== undefined) roles.set(tail.id, 'level_exit');
  });
  for (const node of nodes) {
    if (decisions.has(node.id) && !roles.has(node.id)) roles.set(node.id, 'decision');
  }
  if (first !== undefined) roles.set(first.id, 'start');
  if (last !== undefined) roles.set(last.id, 'end');

  const lengths = runs.map(run => run.nodes.reduce((sum, n, i) => {
    const prev = run.nodes[i - 1];
    return prev === undefined ? sum : sum + distance(prev.position, n.position);
  }, 0));
  const total = lengths.reduce((a, b) => a + b, 0);

  let begin = 0;
  const frames: RouteLevelFrame[] = runs.map((run, i) => {
    const length = lengths[i] ?? 0;
    const dur = total > 0 ? options.duration_s * (length / total) : options.duration_s / runs.length;
    const frame: RouteLevelFrame = {
      level_id: run.level_id,
      node_ids: run.nodes.map(n => n.id),
      decision_node_ids: run.nodes.filter(n => roles.get(n.id) === 'decision').map(n => n.id),
      length_m: Number(formatSvg(length)),
      begin_s: Number(formatSvg(begin)),
      dur_s: Number(formatSvg(dur)),
      svg: frameSvg(run, roles, scene.footprints, options, dur),
      static_svg: frameSvg(run, roles, scene.footprints, options, null),
    };
    begin += dur;
    return frame;
  });

  const level_changes: RouteLevelChange[] = [];
  for (let i = 1; i < runs.length; i++) {
    const from = runs[i - 1]; const to = runs[i];
    const exit = from?.nodes[from.nodes.length - 1];
    const entry = to?.nodes[0];
    if (from === undefined || to === undefined || exit === undefined || entry === undefined) continue;
    level_changes.push({ from_level_id: from.level_id, to_level_id: to.level_id, exit_node_id: exit.id, entry_node_id: entry.id });
  }
  return { ok: true, value: { frames, level_changes }, warnings: [] };
}
