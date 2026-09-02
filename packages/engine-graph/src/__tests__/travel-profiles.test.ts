import { describe, it, expect } from 'vitest';
import { computeRoute } from '../compute-route.js';
import { validateGraph } from '../validate-graph.js';
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
const accProfile = getProfile(refMultilevel.travel_profiles, 'accessible');
const evacProfile = getProfile(refMultilevel.travel_profiles, 'evacuation');

describe('refMultilevel validation', () => {
  it('passes validateGraph', () => {
    const result = validateGraph(refMultilevel);
    expect(result.ok).toBe(true);
  });
});

describe('T-1.9 travel profiles on refMultilevel', () => {
  describe('standard profile', () => {
    it('reaches R+1 destination via elevator (shorter)', () => {
      const result = computeRoute(
        refMultilevel,
        stdProfile,
        'n-ml-entrance',
        'n-ml-dest-r1',
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.path).toContain('n-ml-elevator-rdc');
        expect(result.value.path).toContain('n-ml-elevator-r1');
      }
    });
  });

  describe('accessible profile', () => {
    it('uses only accessible edges (elevator, not stair)', () => {
      const result = computeRoute(
        refMultilevel,
        accProfile,
        'n-ml-entrance',
        'n-ml-dest-r1',
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.path).toContain('n-ml-elevator-rdc');
        expect(result.value.path).toContain('n-ml-elevator-r1');
        expect(result.value.path).not.toContain('n-ml-stair-rdc');
        expect(result.value.path).not.toContain('n-ml-stair-r1');
      }
    });

    it('does not traverse non-accessible edge to stair', () => {
      const result = computeRoute(
        refMultilevel,
        accProfile,
        'n-ml-entrance',
        'n-ml-stair-rdc',
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.findings[0]?.code).toBe('GRAPH.ROUTE_UNREACHABLE');
      }
    });
  });

  describe('evacuation profile', () => {
    it('does not use elevator nodes', () => {
      const result = computeRoute(
        refMultilevel,
        evacProfile,
        'n-ml-entrance',
        'n-ml-stair-r1',
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.path).not.toContain('n-ml-elevator-rdc');
        expect(result.value.path).not.toContain('n-ml-elevator-r1');
        expect(result.value.path).toContain('n-ml-stair-rdc');
      }
    });

    it('cannot reach destination only via elevator', () => {
      const result = computeRoute(
        refMultilevel,
        evacProfile,
        'n-ml-entrance',
        'n-ml-elevator-r1',
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.findings[0]?.code).toBe('GRAPH.ROUTE_UNREACHABLE');
      }
    });

    it('reaches R+1 via stair', () => {
      const result = computeRoute(
        refMultilevel,
        evacProfile,
        'n-ml-entrance',
        'n-ml-dest-r1',
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.path).toContain('n-ml-stair-rdc');
        expect(result.value.path).toContain('n-ml-stair-r1');
      }
    });
  });

  describe('determinism (INV-4)', () => {
    it('same result on two calls for each profile', () => {
      for (const profile of [stdProfile, accProfile, evacProfile]) {
        const r1 = computeRoute(
          refMultilevel,
          profile,
          'n-ml-entrance',
          'n-ml-dest-r1',
        );
        const r2 = computeRoute(
          refMultilevel,
          profile,
          'n-ml-entrance',
          'n-ml-dest-r1',
        );
        expect(r1).toStrictEqual(r2);
      }
    });
  });
});
