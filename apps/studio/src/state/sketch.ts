import type { EntityCommand, Outcome, Point } from '@azimut/core-model';
import { buildCommand, codePointCompare } from '@azimut/core-model';

/**
 * J3 (partie J) — la couche d'esquisse : « réfléchir sur le plan avant de
 * modéliser ».
 *
 * C'est la seule couche où le trait est conservé tel quel : jamais quantifié,
 * jamais converti automatiquement, jamais mesuré (J3.3). La pression module
 * l'épaisseur et l'opacité (J3.2, J0.1). Une esquisse ne participe à aucun
 * calcul et n'apparaît dans aucun livrable ; elle porte son auteur et sa date,
 * et se masque par calque.
 *
 * Les écritures passent par les commandes du module 12, propriétaire des deux
 * tables (L, migration 0072) : un trait posé ou gommé est un geste annulable.
 */
export const SKETCH_TOOLS = ['pencil', 'felt', 'marker'] as const;
export type SketchTool = (typeof SKETCH_TOOLS)[number];

export const SKETCH_COLORS = ['graphite', 'brick', 'ultramarine', 'fir'] as const;
export type SketchColor = (typeof SKETCH_COLORS)[number];

/** Un point du tracé, en mètres, avec la pression lue sous la pointe (0 à 1). */
export type SketchPoint = { readonly x_m: number; readonly y_m: number; readonly p: number };

export type SketchStroke = {
  readonly id: string;
  readonly tool: SketchTool;
  readonly color: SketchColor;
  readonly width_base_m: number;
  readonly points: readonly SketchPoint[];
};

export type SketchLayer = {
  readonly id: string;
  readonly visible: boolean;
  readonly locked: boolean;
};

/**
 * Épaisseur de base de chaque outil, en mètres du site, à pression moyenne.
 * Paramètres d'ergonomie : le crayon pour annoter, le feutre pour esquisser
 * une implantation, le marqueur pour repérer une zone.
 */
export const SKETCH_BASE_WIDTH_M: Readonly<Record<SketchTool, number>> = {
  pencil: 0.03,
  felt: 0.08,
  marker: 0.3,
};

/** Le marqueur est translucide (J3.2) : on voit le plan au travers. */
const MARKER_OPACITY = 0.35;

/**
 * Le rendu d'un segment selon l'outil et la pression : la pression module
 * l'épaisseur et l'opacité (J3.2). Une pression nulle — souris, ou pointeur
 * qui ne la signale pas — vaut la pression moyenne.
 */
export function strokeStyle(tool: SketchTool, pressure: number): { readonly widthFactor: number; readonly opacity: number } {
  const p = pressure > 0 ? Math.min(pressure, 1) : 0.5;
  const widthFactor = 0.5 + p;
  if (tool === 'marker') return { widthFactor, opacity: MARKER_OPACITY };
  return { widthFactor, opacity: tool === 'pencil' ? 0.55 + 0.45 * p : 0.85 };
}

type Row = { readonly table: string; readonly id: string; readonly values: Readonly<Record<string, unknown>> };

function isTool(value: unknown): value is SketchTool {
  return (SKETCH_TOOLS as readonly unknown[]).includes(value);
}

function isColor(value: unknown): value is SketchColor {
  return (SKETCH_COLORS as readonly unknown[]).includes(value);
}

function truthy(value: unknown): boolean {
  return value === true || value === 'true' || value === 't';
}

function live(row: Row): boolean {
  const deleted = row.values['deleted_at'];
  return deleted === undefined || deleted === null || deleted === '';
}

function pointsOf(raw: unknown): readonly SketchPoint[] | null {
  const value: unknown = typeof raw === 'string' ? safeParse(raw) : raw;
  if (!Array.isArray(value)) return null;
  const out: SketchPoint[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) return null;
    const { x_m, y_m, p } = item as Record<string, unknown>;
    if (typeof x_m !== 'number' || typeof y_m !== 'number') return null;
    out.push({ x_m, y_m, p: typeof p === 'number' ? p : 0 });
  }
  return out;
}

function safeParse(text: string): unknown {
  try { return JSON.parse(text); } catch { return null; }
}

/**
 * La couche d'esquisse d'un niveau et ses traits non gommés, lus dans les
 * lignes de la session. Une ligne illisible n'est pas montrée.
 */
export function readSketch(rows: readonly Row[], levelId: string): {
  readonly layer: SketchLayer | null;
  readonly strokes: readonly SketchStroke[];
} {
  const layers = rows
    .filter(r => r.table === 'sketch_layer' && r.values['level_id'] === levelId && live(r))
    .sort((a, b) => codePointCompare(a.id, b.id));
  const head = layers[0];
  if (head === undefined) return { layer: null, strokes: [] };
  const layer: SketchLayer = {
    id: head.id,
    visible: head.values['visible'] === undefined ? true : truthy(head.values['visible']),
    locked: truthy(head.values['locked']),
  };
  const strokes: SketchStroke[] = [];
  for (const row of rows) {
    if (row.table !== 'sketch_stroke' || row.values['layer_id'] !== layer.id || !live(row)) continue;
    const { tool, color } = row.values;
    const width = Number(row.values['width_base_m']);
    const points = pointsOf(row.values['points']);
    if (!isTool(tool) || !isColor(color) || !(width > 0) || points === null) continue;
    strokes.push({ id: row.id, tool, color, width_base_m: width, points });
  }
  return { layer, strokes };
}

export type SketchWrite = {
  readonly orgId: string;
  readonly siteId: string;
  readonly levelId: string;
  readonly timestamp: string;
};

/**
 * Un trait posé. La couche du niveau est créée au premier trait, dans le même
 * geste : une seule annulation retire les deux.
 */
export function sketchStrokeCommands(
  layer: SketchLayer | { readonly newId: string; readonly name: string },
  stroke: { readonly id: string; readonly tool: SketchTool; readonly color: SketchColor; readonly points: readonly SketchPoint[] },
  write: SketchWrite,
): Outcome<readonly EntityCommand[]> {
  const common = {
    module: '12-atelier' as const, org_id: write.orgId, timestamp: write.timestamp,
    groupKey: `sketch:${stroke.id}`, operation: 'create' as const,
  };
  const commands: EntityCommand[] = [];
  const layerId = 'newId' in layer ? layer.newId : layer.id;
  if ('newId' in layer) {
    // De vrais booléens : le client de la base sérialise toute autre valeur
    // en « faux », la chaîne 'true' comprise.
    const created = buildCommand({
      ...common, table: 'sketch_layer', id: layer.newId,
      after: {
        id: layer.newId, org_id: write.orgId, site_id: write.siteId, level_id: write.levelId,
        name: layer.name, visible: true, locked: false,
      },
    });
    if (!created.ok) return created;
    commands.push(created.value);
  }
  const drawn = buildCommand({
    ...common, table: 'sketch_stroke', id: stroke.id,
    after: {
      id: stroke.id, org_id: write.orgId, layer_id: layerId, tool: stroke.tool, color: stroke.color,
      width_base_m: String(SKETCH_BASE_WIDTH_M[stroke.tool]),
      points: JSON.stringify(stroke.points),
    },
  });
  if (!drawn.ok) return drawn;
  commands.push(drawn.value);
  return { ok: true, value: commands, warnings: [] };
}

/** Les traits gommés : supprimés logiquement, d'un seul geste annulable. */
export function eraseCommands(
  strokeIds: readonly string[], write: Pick<SketchWrite, 'orgId' | 'timestamp'>,
): Outcome<readonly EntityCommand[]> {
  const commands: EntityCommand[] = [];
  for (const id of [...strokeIds].sort(codePointCompare)) {
    const built = buildCommand({
      operation: 'update', module: '12-atelier', table: 'sketch_stroke', id,
      org_id: write.orgId, timestamp: write.timestamp, groupKey: `erase:${write.timestamp}`,
      before: { deleted_at: null }, after: { deleted_at: write.timestamp },
    });
    if (!built.ok) return built;
    commands.push(built.value);
  }
  return { ok: true, value: commands, warnings: [] };
}

/** Masquer ou montrer la couche (J3.3). */
export function layerVisibilityCommand(
  layer: SketchLayer, visible: boolean, write: Pick<SketchWrite, 'orgId' | 'timestamp'>,
): Outcome<EntityCommand> {
  return buildCommand({
    operation: 'update', module: '12-atelier', table: 'sketch_layer', id: layer.id,
    org_id: write.orgId, timestamp: write.timestamp, groupKey: `sketch-layer:${layer.id}`,
    before: { visible: layer.visible }, after: { visible },
  });
}

function segmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x_m - a.x_m; const dy = b.y_m - a.y_m;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x_m - a.x_m) * dx + (p.y_m - a.y_m) * dy) / len2));
  return Math.hypot(p.x_m - (a.x_m + t * dx), p.y_m - (a.y_m + t * dy));
}

/** Les traits que la gomme touche, à `reach_m` près. */
export function strokesTouched(
  eraser: readonly Point[], strokes: readonly SketchStroke[], reach_m: number,
): readonly string[] {
  const touched: string[] = [];
  for (const stroke of strokes) {
    const hit = eraser.some(e => stroke.points.some((p, i) => {
      const next = stroke.points[i + 1] ?? p;
      return segmentDistance(e, p, next) <= reach_m;
    }));
    if (hit) touched.push(stroke.id);
  }
  return touched.sort(codePointCompare);
}
