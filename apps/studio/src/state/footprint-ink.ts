import type { Point } from '@azimut/core-model';
import { recognize } from '../editor/ink/recognize.js';
import type { InkCandidate, InkShape } from '../editor/ink/recognize.js';
import { DEFAULT_ANGLE_STEP_DEG } from '../editor/ink/recognition-thresholds.js';
import type { Strictness } from '../editor/ink/recognition-thresholds.js';
import { toleranceFor } from '../editor/ink/pointer-kind.js';
import type { PointerKind } from '../editor/ink/pointer-kind.js';
import type { FootprintTool } from './footprint-shortcuts.js';

/**
 * J1.1 (partie J) appliqué à l'atelier des empreintes (M3, partie M).
 *
 * « Elle ne devine pas la nature métier d'une forme. Un contour tracé devient
 * une empreinte parce que l'outil actif est celui des empreintes » (J2). Seules
 * les candidates qui font une empreinte sont donc retenues, et l'outil actif
 * en fixe l'ordre : la cellule, contrainte aux angles droits, préfère le
 * rectangle ; le polygone libre préfère le polygone ; le rectangle n'accepte
 * que le rectangle.
 *
 * La candidate la plus probable est appliquée au contour en cours ; les autres
 * restent accessibles en un geste ; le trait d'origine reste visible en
 * filigrane tant que l'arbitrage n'est pas clos.
 */
export type FootprintShape = {
  readonly kind: 'rectangle' | 'polygon';
  readonly vertices: readonly Point[];
};

export type FootprintArbitration = {
  readonly readings: readonly FootprintShape[];
  readonly index: number;
  /** Le trait tel que tracé, en filigrane. */
  readonly ghost: readonly Point[];
};

export type InkOutcome =
  | { readonly kind: 'applied'; readonly arbitration: FootprintArbitration }
  | { readonly kind: 'unrecognized'; readonly ghost: readonly Point[] }
  | { readonly kind: 'not_tracing_tool' };

const ORDER: Readonly<Record<FootprintTool, readonly FootprintShape['kind'][]>> = {
  cell: ['rectangle', 'polygon'],
  free_polygon: ['polygon', 'rectangle'],
  rectangle: ['rectangle'],
  select: [],
  vertex: [],
};

/** L'outil actif trace-t-il une empreinte ? */
export function isTracingTool(tool: FootprintTool): boolean {
  return ORDER[tool].length > 0;
}

function asShape(candidate: InkCandidate): FootprintShape | null {
  return candidate.kind === 'rectangle' || candidate.kind === 'polygon'
    ? { kind: candidate.kind, vertices: candidate.vertices }
    : null;
}

/**
 * Les lectures d'un trait pour l'outil actif. Deux lectures identiques — un
 * rectangle est aussi un polygone — n'en font qu'une.
 */
export function footprintReadings(
  candidates: readonly InkCandidate[], tool: FootprintTool,
): readonly FootprintShape[] {
  const shapes = candidates.map(asShape).filter((s): s is FootprintShape => s !== null);
  const readings: FootprintShape[] = [];
  for (const kind of ORDER[tool]) {
    const shape = shapes.find(s => s.kind === kind);
    if (shape === undefined) continue;
    const same = readings.some(r => JSON.stringify(r.vertices) === JSON.stringify(shape.vertices));
    if (!same) readings.push(shape);
  }
  return readings;
}

export type StrokeContext = {
  readonly tool: FootprintTool;
  readonly pointer: PointerKind;
  readonly pxPerMeter: number;
  readonly strictness: Strictness;
  /** Les empreintes déjà posées sur le niveau. */
  readonly footprints: readonly InkShape[];
};

/** Ce qu'un trait achevé produit dans l'atelier des empreintes. */
export function strokeToFootprint(points: readonly Point[], context: StrokeContext): InkOutcome {
  if (!isTracingTool(context.tool)) return { kind: 'not_tracing_tool' };
  const candidates = recognize(points, {
    pxPerMeter: context.pxPerMeter,
    strictness: context.strictness,
    angleStep_deg: DEFAULT_ANGLE_STEP_DEG,
    hit_px: toleranceFor(context.pointer).select_px,
    nodes: [],
    shapes: context.footprints,
  });
  const readings = footprintReadings(candidates, context.tool);
  if (readings.length === 0) return { kind: 'unrecognized', ghost: points };
  return { kind: 'applied', arbitration: { readings, index: 0, ghost: points } };
}

/** L'autre lecture, en un geste ; on revient à la première après la dernière. */
export function nextReading(arbitration: FootprintArbitration): FootprintArbitration {
  return { ...arbitration, index: (arbitration.index + 1) % Math.max(arbitration.readings.length, 1) };
}

/** La lecture retenue. */
export function currentReading(arbitration: FootprintArbitration): FootprintShape | null {
  return arbitration.readings[arbitration.index] ?? null;
}

/** La lecture que le geste suivant proposerait, ou `null` s'il n'y en a qu'une. */
export function alternativeReading(arbitration: FootprintArbitration): FootprintShape | null {
  if (arbitration.readings.length < 2) return null;
  return currentReading(nextReading(arbitration));
}
