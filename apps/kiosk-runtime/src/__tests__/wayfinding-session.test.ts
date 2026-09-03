import { describe, it, expect } from 'vitest';
import { computeWayfinding } from '../wayfinding-session.js';
import { refMultilevel } from '@azimut/testkit';
import type { TravelProfile } from '@azimut/core-model';

const standardProfile: TravelProfile = refMultilevel.travel_profiles.find(
  (p) => p.key === 'standard',
) as TravelProfile;

const accessibleProfile: TravelProfile = refMultilevel.travel_profiles.find(
  (p) => p.key === 'accessible',
) as TravelProfile;

describe('computeWayfinding', () => {
  it('computes route from entrance to RDC destination', () => {
    const result = computeWayfinding(
      refMultilevel,
      standardProfile,
      'n-ml-entrance',
      'n-ml-dest-rdc',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.route.path.length).toBeGreaterThan(1);
    expect(result.value.steps.length).toBeGreaterThan(1);
    expect(result.value.total_distance_m).toBeGreaterThan(0);
    expect(result.value.level_changes).toBe(0);
  });

  it('computes cross-level route', () => {
    const result = computeWayfinding(
      refMultilevel,
      standardProfile,
      'n-ml-entrance',
      'n-ml-dest-r1',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.level_changes).toBeGreaterThanOrEqual(1);
  });

  it('generates French instructions by default', () => {
    const result = computeWayfinding(
      refMultilevel,
      standardProfile,
      'n-ml-entrance',
      'n-ml-dest-rdc',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.steps[0]?.instruction).toContain('Depuis');
    const lastStep = result.value.steps[result.value.steps.length - 1];
    expect(lastStep?.instruction).toContain('Arrivée');
  });

  it('generates English instructions when lang is en', () => {
    const result = computeWayfinding(
      refMultilevel,
      standardProfile,
      'n-ml-entrance',
      'n-ml-dest-rdc',
      { lang: 'en' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.steps[0]?.instruction).toContain('From');
    const lastStep = result.value.steps[result.value.steps.length - 1];
    expect(lastStep?.instruction).toContain('Arrival');
  });

  it('generates French instructions when lang is fr', () => {
    const result = computeWayfinding(
      refMultilevel,
      standardProfile,
      'n-ml-entrance',
      'n-ml-dest-rdc',
      { lang: 'fr' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.steps[0]?.instruction).toContain('Depuis');
  });

  it('respects accessible profile', () => {
    const result = computeWayfinding(
      refMultilevel,
      accessibleProfile,
      'n-ml-entrance',
      'n-ml-dest-r1',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const kinds = result.value.steps.map((s) => s.kind);
    expect(kinds).not.toContain('stair');
  });

  it('returns error for unknown node', () => {
    const result = computeWayfinding(
      refMultilevel,
      standardProfile,
      'nonexistent',
      'n-ml-dest-rdc',
    );
    expect(result.ok).toBe(false);
  });

  it('handles same origin and destination', () => {
    const result = computeWayfinding(
      refMultilevel,
      standardProfile,
      'n-ml-entrance',
      'n-ml-entrance',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total_distance_m).toBe(0);
    expect(result.value.level_changes).toBe(0);
  });

  it('each step has level_id', () => {
    const result = computeWayfinding(
      refMultilevel,
      standardProfile,
      'n-ml-entrance',
      'n-ml-dest-r1',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const step of result.value.steps) {
      expect(step.level_id).toBeTruthy();
    }
  });

  it('is deterministic (INV-4)', () => {
    const r1 = computeWayfinding(
      refMultilevel,
      standardProfile,
      'n-ml-entrance',
      'n-ml-dest-r1',
    );
    const r2 = computeWayfinding(
      refMultilevel,
      standardProfile,
      'n-ml-entrance',
      'n-ml-dest-r1',
    );
    expect(r1).toStrictEqual(r2);
  });

  it('English cross-level uses elevator instruction', () => {
    const result = computeWayfinding(
      refMultilevel,
      standardProfile,
      'n-ml-entrance',
      'n-ml-dest-r1',
      { lang: 'en' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const instructions = result.value.steps.map((s) => s.instruction);
    const hasElevator = instructions.some((i) => i.includes('elevator'));
    const hasStairs = instructions.some((i) => i.includes('stairs'));
    expect(hasElevator || hasStairs).toBe(true);
  });
});
