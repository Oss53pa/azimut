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

describe('T-1.14 reconciliation report', () => {
  describe('superfluous supports', () => {
    it('flags supports at non-decision-point nodes', () => {
      const surveyed: SurveyedSupport[] = [
        {
          id: 'sup-entrance',
          node_id: 'n-ml-entrance',
          azimuth_deg: 0,
          width_m: 0.6,
          height_m: 1.2,
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
      expect(sup[0]?.entity_id).toBe('sup-entrance');
      expect(result.value.superfluous_count).toBe(1);
    });

    it('does NOT flag support at a decision point', () => {
      const surveyed: SurveyedSupport[] = [
        {
          id: 'sup-hall',
          node_id: 'n-ml-hall',
          azimuth_deg: 0,
          width_m: 0.6,
          height_m: 1.2,
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
      expect(sup.length).toBe(0);
    });
  });

  describe('uncovered decision points', () => {
    it('reports decision points without any support', () => {
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
      expect(result.value.uncovered_count).toBe(uncov.length);
      for (const line of uncov) {
        expect(line.entity_kind).toBe('node');
      }
    });
  });

  describe('wrong orientation', () => {
    it('flags support with azimuth outside expected range', () => {
      const surveyed: SurveyedSupport[] = [
        {
          id: 'sup-hall',
          node_id: 'n-ml-hall',
          azimuth_deg: 180,
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
      expect(orient[0]?.entity_id).toBe('sup-hall');
      expect(result.value.orientation_count).toBe(1);
    });

    it('accepts azimuth within tolerance', () => {
      const surveyed: SurveyedSupport[] = [
        {
          id: 'sup-hall',
          node_id: 'n-ml-hall',
          azimuth_deg: 48,
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
      expect(orient.length).toBe(0);
    });

    it('handles wrap-around azimuth (350-10 range)', () => {
      const surveyed: SurveyedSupport[] = [
        {
          id: 'sup-hall',
          node_id: 'n-ml-hall',
          azimuth_deg: 5,
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
  });

  describe('undersized supports', () => {
    it('flags support smaller than expected dimensions', () => {
      const surveyed: SurveyedSupport[] = [
        {
          id: 'sup-hall',
          node_id: 'n-ml-hall',
          azimuth_deg: 20,
          width_m: 0.3,
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
        actual_width_m: 0.3,
        actual_height_m: 0.5,
        min_width_m: 0.4,
        min_height_m: 0.8,
      });
    });

    it('accepts support meeting minimum dimensions', () => {
      const surveyed: SurveyedSupport[] = [
        {
          id: 'sup-hall',
          node_id: 'n-ml-hall',
          azimuth_deg: 20,
          width_m: 0.4,
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
      expect(under.length).toBe(0);
    });
  });

  describe('combined report', () => {
    it('produces all issue types in one report', () => {
      const surveyed: SurveyedSupport[] = [
        {
          id: 'sup-entrance',
          node_id: 'n-ml-entrance',
          azimuth_deg: 0,
          width_m: 0.6,
          height_m: 1.2,
        },
        {
          id: 'sup-hall',
          node_id: 'n-ml-hall',
          azimuth_deg: 180,
          width_m: 0.2,
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
      expect(result.value.superfluous_count).toBeGreaterThanOrEqual(1);
      expect(result.value.orientation_count).toBe(1);
      expect(result.value.undersized_count).toBe(1);
      for (const line of result.value.lines) {
        expect(line.entity_id).toBeTruthy();
      }
    });
  });

  describe('determinism (INV-4)', () => {
    it('same report on two calls with same inputs', () => {
      const surveyed: SurveyedSupport[] = [
        {
          id: 'sup-hall',
          node_id: 'n-ml-hall',
          azimuth_deg: 180,
          width_m: 0.3,
          height_m: 0.5,
        },
        {
          id: 'sup-entrance',
          node_id: 'n-ml-entrance',
          azimuth_deg: 0,
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
      const r1 = reconcile(
        refMultilevel,
        stdProfile,
        surveyed,
        expected,
        5,
      );
      const r2 = reconcile(
        refMultilevel,
        stdProfile,
        surveyed,
        expected,
        5,
      );
      expect(r1).toStrictEqual(r2);
    });
  });

  describe('azimuth boundary with tolerance', () => {
    it('accepts azimuth at wrapping boundary (355° in 0-45 range, tol=5)', () => {
      const sv: SurveyedSupport[] = [{
        id: 'sup-wrap', node_id: 'n-ml-hall',
        azimuth_deg: 355, width_m: 0.6, height_m: 1.2,
      }];
      const ex: ExpectedSupport[] = [{
        node_id: 'n-ml-hall',
        min_azimuth_deg: 0, max_azimuth_deg: 45,
        min_width_m: 0.4, min_height_m: 0.8,
      }];
      const result = reconcile(refMultilevel, stdProfile, sv, ex, 5);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const orient = result.value.lines.filter(
        (l) => l.issue === 'wrong_orientation',
      );
      expect(orient).toHaveLength(0);
    });

    it('flags azimuth outside non-wrapping range (lo <= hi path)', () => {
      const sv: SurveyedSupport[] = [{ id: 'sup-hall', node_id: 'n-ml-hall', azimuth_deg: 270, width_m: 0.6, height_m: 1.2 }];
      const ex: ExpectedSupport[] = [{ node_id: 'n-ml-hall', min_azimuth_deg: 90, max_azimuth_deg: 180, min_width_m: 0.4, min_height_m: 0.8 }];
      const result = reconcile(refMultilevel, stdProfile, sv, ex, 5);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.orientation_count).toBe(1);
    });
  });
});
