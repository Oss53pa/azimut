import { describe, it, expect } from 'vitest';
import { reconcile } from '../reconciliation.js';
import type {
  SurveyedSupport,
  ExpectedSupport,
} from '../reconciliation.js';
import { refMultilevel } from '@azimut/testkit';
import type { TravelProfile } from '@azimut/core-model';

function getProfile(
  profiles: readonly TravelProfile[],
  key: string,
): TravelProfile {
  const p = profiles.find((pr) => pr.key === key);
  if (!p) throw new Error(`No profile with key ${key}`);
  return p;
}

const stdProfile = getProfile(refMultilevel.travel_profiles, 'standard');

describe('reconciliation — undersized single dimension', () => {
  it('flags when only width is below minimum', () => {
    const surveyed: SurveyedSupport[] = [
      {
        id: 'sup-hall',
        node_id: 'n-ml-hall',
        azimuth_deg: 20,
        width_m: 0.3,
        height_m: 0.8,
      },
    ];
    const expected: ExpectedSupport[] = [
      {
        node_id: 'n-ml-hall',
        min_azimuth_deg: 0,
        max_azimuth_deg: 45,
        min_width_m: 0.4,
        min_height_m: 0.8,
      },
    ];
    const result = reconcile(
      refMultilevel,
      stdProfile,
      surveyed,
      expected,
      5,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const under = result.value.lines.filter(
      (l) => l.issue === 'undersized',
    );
    expect(under.length).toBe(1);
    expect(under[0]?.params).toMatchObject({
      actual_width_m: 0.3,
      min_width_m: 0.4,
    });
  });

  it('flags when only height is below minimum', () => {
    const surveyed: SurveyedSupport[] = [
      {
        id: 'sup-hall',
        node_id: 'n-ml-hall',
        azimuth_deg: 20,
        width_m: 0.4,
        height_m: 0.5,
      },
    ];
    const expected: ExpectedSupport[] = [
      {
        node_id: 'n-ml-hall',
        min_azimuth_deg: 0,
        max_azimuth_deg: 45,
        min_width_m: 0.4,
        min_height_m: 0.8,
      },
    ];
    const result = reconcile(
      refMultilevel,
      stdProfile,
      surveyed,
      expected,
      5,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const under = result.value.lines.filter(
      (l) => l.issue === 'undersized',
    );
    expect(under.length).toBe(1);
    expect(under[0]?.params).toMatchObject({
      actual_height_m: 0.5,
      min_height_m: 0.8,
    });
  });
});

describe('reconciliation — orientation tolerance boundaries', () => {
  it('rejects azimuth exactly one degree past tolerance', () => {
    const surveyed: SurveyedSupport[] = [
      {
        id: 'sup-hall',
        node_id: 'n-ml-hall',
        azimuth_deg: 51,
        width_m: 0.6,
        height_m: 1.2,
      },
    ];
    const expected: ExpectedSupport[] = [
      {
        node_id: 'n-ml-hall',
        min_azimuth_deg: 0,
        max_azimuth_deg: 45,
        min_width_m: 0.4,
        min_height_m: 0.8,
      },
    ];
    const result = reconcile(
      refMultilevel,
      stdProfile,
      surveyed,
      expected,
      5,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const orient = result.value.lines.filter(
      (l) => l.issue === 'wrong_orientation',
    );
    expect(orient.length).toBe(1);
  });

  it('accepts azimuth at 0 within wrap-around range near 360', () => {
    const surveyed: SurveyedSupport[] = [
      {
        id: 'sup-hall',
        node_id: 'n-ml-hall',
        azimuth_deg: 0,
        width_m: 0.6,
        height_m: 1.2,
      },
    ];
    const expected: ExpectedSupport[] = [
      {
        node_id: 'n-ml-hall',
        min_azimuth_deg: 350,
        max_azimuth_deg: 10,
        min_width_m: 0.4,
        min_height_m: 0.8,
      },
    ];
    const result = reconcile(
      refMultilevel,
      stdProfile,
      surveyed,
      expected,
      0,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const orient = result.value.lines.filter(
      (l) => l.issue === 'wrong_orientation',
    );
    expect(orient.length).toBe(0);
  });

  it('rejects azimuth outside wrap-around range with tolerance', () => {
    const surveyed: SurveyedSupport[] = [
      {
        id: 'sup-hall',
        node_id: 'n-ml-hall',
        azimuth_deg: 20,
        width_m: 0.6,
        height_m: 1.2,
      },
    ];
    const expected: ExpectedSupport[] = [
      {
        node_id: 'n-ml-hall',
        min_azimuth_deg: 350,
        max_azimuth_deg: 10,
        min_width_m: 0.4,
        min_height_m: 0.8,
      },
    ];
    const result = reconcile(
      refMultilevel,
      stdProfile,
      surveyed,
      expected,
      5,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const orient = result.value.lines.filter(
      (l) => l.issue === 'wrong_orientation',
    );
    expect(orient.length).toBe(1);
  });
});

describe('reconciliation — superfluous detection', () => {
  it('flags support on non-decision-point node as superfluous', () => {
    // n-ml-dest-rdc is a destination_access node (degree 1) → not a decision point
    const surveyed: SurveyedSupport[] = [
      {
        id: 'sup-orphan',
        node_id: 'n-ml-dest-rdc',
        azimuth_deg: 0,
        width_m: 0.5,
        height_m: 1.0,
      },
    ];
    const result = reconcile(
      refMultilevel,
      stdProfile,
      surveyed,
      [],
      5,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sup = result.value.lines.filter(
      (l) => l.issue === 'superfluous',
    );
    expect(sup.length).toBe(1);
    expect(sup[0]?.entity_id).toBe('sup-orphan');
    expect(result.value.superfluous_count).toBe(1);
  });
});

describe('reconciliation — uncovered detection', () => {
  it('flags decision-point nodes with no surveyed support', () => {
    // Empty surveyed → all decision points are uncovered
    const result = reconcile(
      refMultilevel,
      stdProfile,
      [],
      [],
      5,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const uncov = result.value.lines.filter(
      (l) => l.issue === 'uncovered',
    );
    expect(uncov.length).toBeGreaterThan(0);
    expect(uncov[0]?.entity_kind).toBe('node');
    expect(result.value.uncovered_count).toBe(uncov.length);
  });
});

describe('reconciliation — combined issues', () => {
  it('flags both dimensions undersized in a single line', () => {
    const surveyed: SurveyedSupport[] = [
      {
        id: 'sup-small',
        node_id: 'n-ml-hall',
        azimuth_deg: 20,
        width_m: 0.2,
        height_m: 0.3,
      },
    ];
    const expected: ExpectedSupport[] = [
      {
        node_id: 'n-ml-hall',
        min_azimuth_deg: 0,
        max_azimuth_deg: 45,
        min_width_m: 0.4,
        min_height_m: 0.8,
      },
    ];
    const result = reconcile(
      refMultilevel,
      stdProfile,
      surveyed,
      expected,
      5,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const under = result.value.lines.filter(
      (l) => l.issue === 'undersized',
    );
    // Only one undersized line even though both dimensions fail
    expect(under.length).toBe(1);
    expect(under[0]?.params['actual_width_m']).toBe(0.2);
    expect(under[0]?.params['actual_height_m']).toBe(0.3);
  });

  it('emits both wrong_orientation and undersized for same support', () => {
    const surveyed: SurveyedSupport[] = [
      {
        id: 'sup-bad',
        node_id: 'n-ml-hall',
        azimuth_deg: 180,
        width_m: 0.2,
        height_m: 0.3,
      },
    ];
    const expected: ExpectedSupport[] = [
      {
        node_id: 'n-ml-hall',
        min_azimuth_deg: 0,
        max_azimuth_deg: 45,
        min_width_m: 0.4,
        min_height_m: 0.8,
      },
    ];
    const result = reconcile(
      refMultilevel,
      stdProfile,
      surveyed,
      expected,
      5,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const issues = result.value.lines
      .filter((l) => l.entity_id === 'sup-bad')
      .map((l) => l.issue);
    expect(issues).toContain('wrong_orientation');
    expect(issues).toContain('undersized');
    expect(result.value.orientation_count).toBe(1);
    expect(result.value.undersized_count).toBe(1);
  });

  it('skips orientation/size checks when no expected entry', () => {
    const surveyed: SurveyedSupport[] = [
      {
        id: 'sup-hall',
        node_id: 'n-ml-hall',
        azimuth_deg: 180,
        width_m: 0.1,
        height_m: 0.1,
      },
    ];
    // No expected entry for n-ml-hall → skip checks
    const result = reconcile(
      refMultilevel,
      stdProfile,
      surveyed,
      [],
      5,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const orient = result.value.lines.filter(
      (l) => l.issue === 'wrong_orientation',
    );
    const under = result.value.lines.filter(
      (l) => l.issue === 'undersized',
    );
    expect(orient.length).toBe(0);
    expect(under.length).toBe(0);
  });
});
