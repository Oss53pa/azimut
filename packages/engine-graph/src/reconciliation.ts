import type {
  SiteData,
  TravelProfile,
  Outcome,
} from '@azimut/core-model';
import { deriveDecisionPoints } from './decision-points.js';

export type SurveyedSupport = {
  readonly id: string;
  readonly node_id: string;
  readonly azimuth_deg: number;
  readonly width_m: number;
  readonly height_m: number;
};

export type ReconciliationLine = {
  readonly entity_id: string;
  readonly entity_kind: 'support' | 'node';
  readonly issue:
    | 'superfluous'
    | 'uncovered'
    | 'wrong_orientation'
    | 'undersized';
  readonly params: Record<string, string | number>;
};

export type ReconciliationReport = {
  readonly lines: readonly ReconciliationLine[];
  readonly superfluous_count: number;
  readonly uncovered_count: number;
  readonly orientation_count: number;
  readonly undersized_count: number;
};

export type ExpectedSupport = {
  readonly node_id: string;
  readonly min_azimuth_deg: number;
  readonly max_azimuth_deg: number;
  readonly min_width_m: number;
  readonly min_height_m: number;
};

function normalizeAzimuth(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function isAzimuthInRange(
  actual: number,
  min: number,
  max: number,
  tolerance: number,
): boolean {
  const a = normalizeAzimuth(actual);
  const lo = normalizeAzimuth(min - tolerance);
  const hi = normalizeAzimuth(max + tolerance);
  if (lo <= hi) {
    return a >= lo && a <= hi;
  }
  return a >= lo || a <= hi;
}

export function reconcile(
  site: SiteData,
  profile: TravelProfile,
  surveyed: readonly SurveyedSupport[],
  expected: readonly ExpectedSupport[],
  orientationToleranceDeg: number,
): Outcome<ReconciliationReport> {
  const dpResult = deriveDecisionPoints(
    site,
    profile,
    site.destinations,
  );
  if (!dpResult.ok) return dpResult as Outcome<ReconciliationReport>;

  const dpNodeIds = new Set(dpResult.value.map((dp) => dp.node_id));

  const lines: ReconciliationLine[] = [];

  const sortedSurveyed = [...surveyed].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (const s of sortedSurveyed) {
    if (!dpNodeIds.has(s.node_id)) {
      lines.push({
        entity_id: s.id,
        entity_kind: 'support',
        issue: 'superfluous',
        params: { node_id: s.node_id },
      });
    }
  }

  const coveredNodes = new Set<string>();
  for (const s of surveyed) {
    if (dpNodeIds.has(s.node_id)) {
      coveredNodes.add(s.node_id);
    }
  }
  const sortedDpNodes = [...dpNodeIds].sort();
  for (const nodeId of sortedDpNodes) {
    if (!coveredNodes.has(nodeId)) {
      lines.push({
        entity_id: nodeId,
        entity_kind: 'node',
        issue: 'uncovered',
        params: {},
      });
    }
  }

  const expectedByNode = new Map<string, ExpectedSupport>();
  for (const e of expected) {
    expectedByNode.set(e.node_id, e);
  }

  for (const s of sortedSurveyed) {
    const exp = expectedByNode.get(s.node_id);
    if (!exp) continue;

    if (
      !isAzimuthInRange(
        s.azimuth_deg,
        exp.min_azimuth_deg,
        exp.max_azimuth_deg,
        orientationToleranceDeg,
      )
    ) {
      lines.push({
        entity_id: s.id,
        entity_kind: 'support',
        issue: 'wrong_orientation',
        params: {
          actual_deg: normalizeAzimuth(s.azimuth_deg),
          expected_min_deg: normalizeAzimuth(exp.min_azimuth_deg),
          expected_max_deg: normalizeAzimuth(exp.max_azimuth_deg),
        },
      });
    }

    if (s.width_m < exp.min_width_m || s.height_m < exp.min_height_m) {
      lines.push({
        entity_id: s.id,
        entity_kind: 'support',
        issue: 'undersized',
        params: {
          actual_width_m: s.width_m,
          actual_height_m: s.height_m,
          min_width_m: exp.min_width_m,
          min_height_m: exp.min_height_m,
        },
      });
    }
  }

  return {
    ok: true,
    value: {
      lines,
      superfluous_count: lines.filter((l) => l.issue === 'superfluous')
        .length,
      uncovered_count: lines.filter((l) => l.issue === 'uncovered')
        .length,
      orientation_count: lines.filter(
        (l) => l.issue === 'wrong_orientation',
      ).length,
      undersized_count: lines.filter((l) => l.issue === 'undersized')
        .length,
    },
    warnings: [],
  };
}
