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

function sv(overrides?: Partial<SurveyedSupport>): SurveyedSupport {
  return { id: 'sup-hall', node_id: 'n-ml-hall', azimuth_deg: 20, width_m: 0.6, height_m: 1.2, ...overrides };
}

function ex(overrides?: Partial<ExpectedSupport>): ExpectedSupport {
  return { node_id: 'n-ml-hall', min_azimuth_deg: 0, max_azimuth_deg: 45, min_width_m: 0.4, min_height_m: 0.8, ...overrides };
}

function run(surveyed: SurveyedSupport[], expected: ExpectedSupport[], tol = 5) {
  return reconcile(refMultilevel, stdProfile, surveyed, expected, tol);
}

describe('reconciliation — undersized single dimension', () => {
  it('flags when only width is below minimum', () => {
    const result = run([sv({ width_m: 0.3, height_m: 0.8 })], [ex()]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const under = result.value.lines.filter((l) => l.issue === 'undersized');
    expect(under.length).toBe(1);
    expect(under[0]?.params).toMatchObject({ actual_width_m: 0.3, min_width_m: 0.4 });
  });

  it('flags when only height is below minimum', () => {
    const result = run([sv({ width_m: 0.4, height_m: 0.5 })], [ex()]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const under = result.value.lines.filter((l) => l.issue === 'undersized');
    expect(under.length).toBe(1);
    expect(under[0]?.params).toMatchObject({ actual_height_m: 0.5, min_height_m: 0.8 });
  });
});

describe('reconciliation — orientation tolerance boundaries', () => {
  it('rejects azimuth exactly one degree past tolerance', () => {
    const result = run([sv({ azimuth_deg: 51 })], [ex()]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const orient = result.value.lines.filter((l) => l.issue === 'wrong_orientation');
    expect(orient.length).toBe(1);
  });

  it('accepts azimuth at 0 within wrap-around range near 360', () => {
    const result = run([sv({ azimuth_deg: 0 })], [ex({ min_azimuth_deg: 350, max_azimuth_deg: 10 })], 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const orient = result.value.lines.filter((l) => l.issue === 'wrong_orientation');
    expect(orient.length).toBe(0);
  });

  it('rejects azimuth outside wrap-around range with tolerance', () => {
    const result = run([sv({ azimuth_deg: 20 })], [ex({ min_azimuth_deg: 350, max_azimuth_deg: 10 })]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const orient = result.value.lines.filter((l) => l.issue === 'wrong_orientation');
    expect(orient.length).toBe(1);
  });
});

describe('reconciliation — superfluous detection', () => {
  it('flags support on non-decision-point node as superfluous', () => {
    const result = run([sv({ id: 'sup-orphan', node_id: 'n-ml-dest-rdc', azimuth_deg: 0, width_m: 0.5, height_m: 1.0 })], []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sup = result.value.lines.filter((l) => l.issue === 'superfluous');
    expect(sup.length).toBe(1);
    expect(sup[0]?.entity_id).toBe('sup-orphan');
    expect(result.value.superfluous_count).toBe(1);
  });
});

describe('reconciliation — uncovered detection', () => {
  it('flags decision-point nodes with no surveyed support', () => {
    const result = run([], []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const uncov = result.value.lines.filter((l) => l.issue === 'uncovered');
    expect(uncov.length).toBeGreaterThan(0);
    expect(uncov[0]?.entity_kind).toBe('node');
    expect(result.value.uncovered_count).toBe(uncov.length);
  });
});

describe('reconciliation — combined issues', () => {
  it('flags both dimensions undersized in a single line', () => {
    const result = run([sv({ id: 'sup-small', width_m: 0.2, height_m: 0.3 })], [ex()]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const under = result.value.lines.filter((l) => l.issue === 'undersized');
    expect(under.length).toBe(1);
    expect(under[0]?.params['actual_width_m']).toBe(0.2);
    expect(under[0]?.params['actual_height_m']).toBe(0.3);
  });

  it('emits both wrong_orientation and undersized for same support', () => {
    const result = run([sv({ id: 'sup-bad', azimuth_deg: 180, width_m: 0.2, height_m: 0.3 })], [ex()]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const issues = result.value.lines.filter((l) => l.entity_id === 'sup-bad').map((l) => l.issue);
    expect(issues).toContain('wrong_orientation');
    expect(issues).toContain('undersized');
    expect(result.value.orientation_count).toBe(1);
    expect(result.value.undersized_count).toBe(1);
  });

  it('skips orientation/size checks when no expected entry', () => {
    const result = run([sv({ azimuth_deg: 180, width_m: 0.1, height_m: 0.1 })], []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.lines.filter((l) => l.issue === 'wrong_orientation').length).toBe(0);
    expect(result.value.lines.filter((l) => l.issue === 'undersized').length).toBe(0);
  });

  it('accepts azimuth within non-wrapping range (lo ≤ hi)', () => {
    const result = run([sv({ azimuth_deg: 120 })], [ex({ min_azimuth_deg: 90, max_azimuth_deg: 180 })]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.lines.filter((l) => l.issue === 'wrong_orientation').length).toBe(0);
  });

  it('rejects azimuth outside non-wrapping range (lo ≤ hi)', () => {
    const result = run([sv({ azimuth_deg: 250 })], [ex({ min_azimuth_deg: 90, max_azimuth_deg: 180 })]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.lines.filter((l) => l.issue === 'wrong_orientation').length).toBe(1);
  });
});
