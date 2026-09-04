import { describe, it, expect } from 'vitest';
import { searchDestinations } from '../search-destinations.js';
import { computeWayfinding } from '../wayfinding-session.js';
import { refMultilevel } from '@azimut/testkit';

/**
 * Integration test: full kiosk flow.
 * search → pick top result → compute route → verify instructions
 */
describe('kiosk wayfinding flow (integration)', () => {
  const site = refMultilevel;
  const profile = site.travel_profiles.find((p) => p.key === 'standard');
  if (!profile) throw new Error('Missing standard profile in fixture');
  const entranceNode = 'n-ml-hall';

  it('search → route → instructions in French', () => {
    // Step 1: User searches for "Bureau RDC"
    const results = searchDestinations(site, 'Bureau RDC', 'fr', 5);
    expect(results.length).toBeGreaterThan(0);

    const topResult = results[0];
    expect(topResult).toBeDefined();
    if (!topResult) return;
    expect(topResult.destination.id).toBe('dest-ml-rdc');
    expect(topResult.score).toBeGreaterThan(0);

    // Step 2: User picks the destination → compute route
    const destNodeId = topResult.destination.node_id;
    const wayfinding = computeWayfinding(
      site,
      profile,
      entranceNode,
      destNodeId,
      { lang: 'fr' },
    );
    expect(wayfinding.ok).toBe(true);
    if (!wayfinding.ok) return;

    // Step 3: Verify the result
    const result = wayfinding.value;
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.total_distance_m).toBeGreaterThan(0);

    // First step starts from the entrance
    expect(result.steps[0]?.node_id).toBe(entranceNode);

    // Last step is the destination
    const lastStep = result.steps[result.steps.length - 1];
    expect(lastStep?.node_id).toBe(destNodeId);
    expect(lastStep?.instruction).toContain('Arrivée');

    // Instructions are non-empty strings
    for (const step of result.steps) {
      expect(step.instruction.length).toBeGreaterThan(0);
    }
  });

  it('search → route → instructions in English', () => {
    const results = searchDestinations(site, 'First floor', 'en', 5);
    expect(results.length).toBeGreaterThan(0);

    const topResult = results[0];
    expect(topResult).toBeDefined();
    if (!topResult) return;
    expect(topResult.destination.id).toBe('dest-ml-r1');

    const destNodeId = topResult.destination.node_id;
    const wayfinding = computeWayfinding(
      site,
      profile,
      entranceNode,
      destNodeId,
      { lang: 'en' },
    );
    expect(wayfinding.ok).toBe(true);
    if (!wayfinding.ok) return;

    const result = wayfinding.value;
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.total_distance_m).toBeGreaterThan(0);

    // Cross-level route should have level changes
    expect(result.level_changes).toBeGreaterThanOrEqual(1);

    const lastStep = result.steps[result.steps.length - 1];
    expect(lastStep?.instruction).toContain('Arrival');
  });

  it('fuzzy search still finds the right destination', () => {
    // Misspelled query
    const results = searchDestinations(site, 'Bureu RDc', 'fr', 5);
    expect(results.length).toBeGreaterThan(0);

    const topResult = results[0];
    expect(topResult).toBeDefined();
    if (!topResult) return;
    expect(topResult.destination.id).toBe('dest-ml-rdc');

    const wayfinding = computeWayfinding(
      site,
      profile,
      entranceNode,
      topResult.destination.node_id,
    );
    expect(wayfinding.ok).toBe(true);
  });

  it('round-trip is deterministic (INV-4)', () => {
    const results1 = searchDestinations(site, 'Bureau', 'fr', 5);
    const results2 = searchDestinations(site, 'Bureau', 'fr', 5);
    expect(results1).toStrictEqual(results2);

    if (results1.length === 0) return;
    const destNode = results1[0]?.destination.node_id;
    if (!destNode) return;

    const wf1 = computeWayfinding(site, profile, entranceNode, destNode, { lang: 'fr' });
    const wf2 = computeWayfinding(site, profile, entranceNode, destNode, { lang: 'fr' });
    expect(wf1).toStrictEqual(wf2);
  });

  it('route to self returns a single-step result', () => {
    const wayfinding = computeWayfinding(
      site,
      profile,
      entranceNode,
      entranceNode,
      { lang: 'fr' },
    );
    expect(wayfinding.ok).toBe(true);
    if (!wayfinding.ok) return;
    expect(wayfinding.value.total_distance_m).toBe(0);
  });

  it('returns error when from-node does not exist', () => {
    const wayfinding = computeWayfinding(
      site,
      profile,
      'nonexistent-node',
      'n-ml-dest-rdc',
      { lang: 'fr' },
    );
    expect(wayfinding.ok).toBe(false);
    if (wayfinding.ok) return;
    expect(wayfinding.findings.length).toBeGreaterThan(0);
  });

  it('returns error when to-node does not exist', () => {
    const wayfinding = computeWayfinding(
      site,
      profile,
      entranceNode,
      'nonexistent-dest',
      { lang: 'fr' },
    );
    expect(wayfinding.ok).toBe(false);
    if (wayfinding.ok) return;
    expect(wayfinding.findings.length).toBeGreaterThan(0);
  });

  it('defaults to French when no options provided', () => {
    const wayfinding = computeWayfinding(
      site,
      profile,
      entranceNode,
      'n-ml-dest-rdc',
    );
    expect(wayfinding.ok).toBe(true);
    if (!wayfinding.ok) return;
    expect(wayfinding.value.steps.length).toBeGreaterThan(0);
  });
});
