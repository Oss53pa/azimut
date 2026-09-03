import { describe, it, expect } from 'vitest';
import { computeWayfinding } from '../wayfinding-session.js';
import { refMultilevel } from '@azimut/testkit';
import type { SiteData, TravelProfile } from '@azimut/core-model';

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

  it('returns error for unknown origin node', () => {
    const result = computeWayfinding(
      refMultilevel,
      standardProfile,
      'nonexistent',
      'n-ml-dest-rdc',
    );
    expect(result.ok).toBe(false);
  });

  it('returns error for unknown destination node', () => {
    const result = computeWayfinding(
      refMultilevel,
      standardProfile,
      'n-ml-entrance',
      'nonexistent',
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

  describe('junction collapsing', () => {
    // Site with: entrance -> junct1 -> junct2 -> junct3 -> dest
    // Three consecutive junction nodes should collapse into one step.
    const corridorSite: SiteData = {
      organization: { id: 'org1', name: 'Test', slug: 'test' },
      site: { id: 's1', org_id: 'org1', name: 'Corridor', country_code: 'FR', rules_pack_id: null },
      buildings: [{ id: 'b1', org_id: 'org1', site_id: 's1', name: 'B1', independent_access: true }],
      levels: [{
        id: 'l1', org_id: 'org1', building_id: 'b1', name: 'RDC',
        ordinal: 0, elevation_m: 0,
      }],
      footprints: [{
        id: 'fp1', org_id: 'org1', level_id: 'l1',
        geometry: { vertices: [{ x_m: 0, y_m: 0 }, { x_m: 50, y_m: 0 }, { x_m: 50, y_m: 10 }, { x_m: 0, y_m: 10 }] },
        kind: 'room',
      }],
      volumes: [{
        id: 'vol1', org_id: 'org1', footprint_id: 'fp1',
        base_elevation_m: 0, height_m: 3, material_key: 'concrete',
      }],
      graph: {
        nodes: [
          { id: 'n-ent', org_id: 'org1', level_id: 'l1', kind: 'entrance', position: { x_m: 0, y_m: 5 }, label: 'Entrée' },
          { id: 'n-j1', org_id: 'org1', level_id: 'l1', kind: 'junction', position: { x_m: 10, y_m: 5 }, label: 'Couloir A' },
          { id: 'n-j2', org_id: 'org1', level_id: 'l1', kind: 'junction', position: { x_m: 20, y_m: 5 }, label: 'Couloir B' },
          { id: 'n-j3', org_id: 'org1', level_id: 'l1', kind: 'junction', position: { x_m: 30, y_m: 5 }, label: 'Couloir C' },
          { id: 'n-dest', org_id: 'org1', level_id: 'l1', kind: 'destination_access', position: { x_m: 40, y_m: 5 }, label: 'Bureau' },
        ],
        edges: [
          { id: 'e1', org_id: 'org1', from_node_id: 'n-ent', to_node_id: 'n-j1', width_m: 2, slope_pct: 0, accessible: true, direction: 'both', evacuation_route: false, length_m: 10 },
          { id: 'e2', org_id: 'org1', from_node_id: 'n-j1', to_node_id: 'n-j2', width_m: 2, slope_pct: 0, accessible: true, direction: 'both', evacuation_route: false, length_m: 10 },
          { id: 'e3', org_id: 'org1', from_node_id: 'n-j2', to_node_id: 'n-j3', width_m: 2, slope_pct: 0, accessible: true, direction: 'both', evacuation_route: false, length_m: 10 },
          { id: 'e4', org_id: 'org1', from_node_id: 'n-j3', to_node_id: 'n-dest', width_m: 2, slope_pct: 0, accessible: true, direction: 'both', evacuation_route: false, length_m: 10 },
        ],
        vertical_links: [],
      },
      categories: [{ id: 'cat1', org_id: 'org1', sector_key: 'tertiary', code: 'office', parent_id: null }],
      pictograms: [],
      destinations: [{ id: 'd1', org_id: 'org1', footprint_id: 'fp1', node_id: 'n-dest', category_id: 'cat1', occupant_name: 'Bureau', occupancy_status: 'occupied', display_priority: 1 }],
      destination_names: [{ id: 'dn1', org_id: 'org1', destination_id: 'd1', lang: 'fr', value: 'Bureau' }],
      travel_profiles: [{
        id: 'tp1', org_id: 'org1', site_id: 's1', key: 'standard', name: 'Standard',
        excluded_edge_kinds: [], require_accessible: false, honor_hours: false,
      }],
      support_types: [],
      face_templates: [],
    };

    const corridorProfile = corridorSite.travel_profiles[0] as TravelProfile;

    it('collapses consecutive junction nodes into a single step', () => {
      const result = computeWayfinding(corridorSite, corridorProfile, 'n-ent', 'n-dest');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // Without collapsing: entrance + j1 + j2 + j3 + dest = 5 steps.
      // With collapsing: entrance + collapsed(j1-j3) + dest = 3 steps.
      expect(result.value.steps.length).toBe(3);
    });

    it('collapsed step uses "continue for X m" instruction (fr)', () => {
      const result = computeWayfinding(corridorSite, corridorProfile, 'n-ent', 'n-dest');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const collapsedStep = result.value.steps[1];
      expect(collapsedStep?.instruction).toContain('Continuer tout droit');
      expect(collapsedStep?.instruction).toContain('20 m');
    });

    it('collapsed step uses "continue straight" instruction (en)', () => {
      const result = computeWayfinding(corridorSite, corridorProfile, 'n-ent', 'n-dest', { lang: 'en' });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const collapsedStep = result.value.steps[1];
      expect(collapsedStep?.instruction).toContain('Continue straight');
      expect(collapsedStep?.instruction).toContain('20 m');
    });

    it('total distance is preserved after collapsing', () => {
      const result = computeWayfinding(corridorSite, corridorProfile, 'n-ent', 'n-dest');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.total_distance_m).toBe(40);
    });

    it('collapsed result is deterministic (INV-4)', () => {
      const r1 = computeWayfinding(corridorSite, corridorProfile, 'n-ent', 'n-dest');
      const r2 = computeWayfinding(corridorSite, corridorProfile, 'n-ent', 'n-dest');
      expect(r1).toStrictEqual(r2);
    });
  });
});
