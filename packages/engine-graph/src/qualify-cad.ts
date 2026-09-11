import { roundSvg } from '@azimut/core-model';

/**
 * D4.3 — CAD file qualification.
 *
 * Before any import attempt, a CAD file is qualified and a report is produced.
 * This module works on a neutral, already-parsed entity set (the DXF/DWG →
 * CadEntitySet adapter is out of scope, like other external-format adapters):
 * it computes the D4.3 metrics, estimates an expected extraction rate, and —
 * below a configurable threshold — recommends manual tracing over import and
 * says why. A half-successful silent import costs more than a redraw and
 * degrades the product's central economic indicator (time-to-commission).
 */

export type CadUnit = 'mm' | 'cm' | 'm';

export type CadEntity = {
  readonly kind: 'polyline' | 'line' | 'arc' | 'text' | 'block' | 'other';
  readonly layer: string;
  /** For polylines: whether the ring is closed. */
  readonly closed?: boolean;
  /**
   * Optional geometric signature (e.g. a hash of rounded vertices). When two
   * entities share a signature they are counted as a superposed duplicate.
   */
  readonly signature?: string;
};

export type CadLayer = {
  readonly name: string;
  /** Whether the layer maps to an exploitable business layer. */
  readonly exploitable: boolean;
};

export type CadEntitySet = {
  readonly entities: readonly CadEntity[];
  readonly layers: readonly CadLayer[];
  /** Declared drawing unit, or null when the file declares none. */
  readonly declaredUnit: CadUnit | null;
  /** External references the file points to but that are missing. */
  readonly missingXrefs: readonly string[];
  /** Number of building levels present in the same file. */
  readonly levelCount: number;
};

export type CadQualificationOptions = {
  /** Below this expected extraction rate, manual tracing is recommended. */
  readonly extractionThreshold?: number;
};

export type CadQualificationReport = {
  readonly totalEntities: number;
  readonly polylineCount: number;
  readonly closedPolylineCount: number;
  /** Closed polylines over all entities (D4.3). */
  readonly closedPolylineRatio: number;
  readonly layerCount: number;
  readonly exploitableLayerCount: number;
  readonly exploitableLayerRate: number;
  readonly unitDeclared: boolean;
  readonly declaredUnit: CadUnit | null;
  readonly missingXrefs: readonly string[];
  readonly duplicateOverlapCount: number;
  readonly levelCount: number;
  readonly expectedExtractionRate: number;
  readonly recommendation: 'import' | 'manual_tracing';
  readonly reasons: readonly string[];
};

const DEFAULT_THRESHOLD = 0.6;

function ratio(part: number, whole: number): number {
  return whole === 0 ? 0 : roundSvg(part / whole);
}

function countDuplicateOverlaps(entities: readonly CadEntity[]): number {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const e of entities) {
    if (e.signature === undefined) continue;
    if (seen.has(e.signature)) duplicates += 1;
    else seen.add(e.signature);
  }
  return duplicates;
}

/**
 * Expected extraction rate — a documented heuristic in [0, 1]. It rewards a
 * high share of closed polylines (the extractable footprints) and exploitable
 * layers with a declared unit, and penalises missing xrefs, superposed
 * duplicates and multi-level files (which need splitting).
 */
function estimateExtractionRate(
  closedShareOfPolylines: number,
  exploitableLayerRate: number,
  unitDeclared: boolean,
  missingXrefCount: number,
  duplicateCount: number,
  levelCount: number,
): number {
  const base =
    0.5 * closedShareOfPolylines
    + 0.3 * exploitableLayerRate
    + 0.2 * (unitDeclared ? 1 : 0);
  const penalty =
    Math.min(0.2, 0.05 * missingXrefCount)
    + Math.min(0.2, 0.02 * duplicateCount)
    + (levelCount > 1 ? 0.1 : 0);
  const raw = base - penalty;
  return roundSvg(Math.max(0, Math.min(1, raw)));
}

export function qualifyCad(
  set: CadEntitySet,
  options: CadQualificationOptions = {},
): CadQualificationReport {
  const threshold = options.extractionThreshold ?? DEFAULT_THRESHOLD;

  const totalEntities = set.entities.length;
  const polylines = set.entities.filter((e) => e.kind === 'polyline');
  const polylineCount = polylines.length;
  const closedPolylineCount = polylines.filter((e) => e.closed === true).length;

  const layerCount = set.layers.length;
  const exploitableLayerCount = set.layers.filter((l) => l.exploitable).length;

  const duplicateOverlapCount = countDuplicateOverlaps(set.entities);
  const closedShareOfPolylines = ratio(closedPolylineCount, polylineCount);
  const exploitableLayerRate = ratio(exploitableLayerCount, layerCount);
  const unitDeclared = set.declaredUnit !== null;

  const expectedExtractionRate = estimateExtractionRate(
    closedShareOfPolylines,
    exploitableLayerRate,
    unitDeclared,
    set.missingXrefs.length,
    duplicateOverlapCount,
    set.levelCount,
  );

  const reasons: string[] = [];
  if (closedShareOfPolylines < 0.8) {
    reasons.push('faible proportion de polylignes fermées');
  }
  if (exploitableLayerRate < 0.8) {
    reasons.push('taux de calques exploitables faible');
  }
  if (!unitDeclared) reasons.push('unité non déclarée');
  if (set.missingXrefs.length > 0) {
    reasons.push(`${set.missingXrefs.length} référence(s) externe(s) manquante(s)`);
  }
  if (duplicateOverlapCount > 0) {
    reasons.push(`${duplicateOverlapCount} entité(s) superposée(s) en double`);
  }
  if (set.levelCount > 1) {
    reasons.push(`${set.levelCount} niveaux dans le même fichier`);
  }

  const recommendation =
    expectedExtractionRate < threshold ? 'manual_tracing' : 'import';

  return {
    totalEntities,
    polylineCount,
    closedPolylineCount,
    closedPolylineRatio: ratio(closedPolylineCount, totalEntities),
    layerCount,
    exploitableLayerCount,
    exploitableLayerRate,
    unitDeclared,
    declaredUnit: set.declaredUnit,
    missingXrefs: [...set.missingXrefs].sort(),
    duplicateOverlapCount,
    levelCount: set.levelCount,
    expectedExtractionRate,
    recommendation,
    reasons,
  };
}
