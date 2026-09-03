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
