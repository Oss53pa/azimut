import { describe, it, expect } from 'vitest';
import { computeWayfinding } from '../wayfinding-session.js';
import { refMultilevel } from '@azimut/testkit';
import type { SiteData, TravelProfile } from '@azimut/core-model';
import type { WayfindingOptions } from '../wayfinding-session.js';

const stdP: TravelProfile = refMultilevel.travel_profiles.find(
  (p) => p.key === 'standard',
) as TravelProfile;

const accP: TravelProfile = refMultilevel.travel_profiles.find(
  (p) => p.key === 'accessible',
) as TravelProfile;

/** Compact wayfinding call — returns value or throws. */
function wf(
  from: string, to: string,
  opts?: { site?: SiteData; profile?: TravelProfile; lang?: WayfindingOptions['lang'] },
) {
  const result = computeWayfinding(
    opts?.site ?? refMultilevel, opts?.profile ?? stdP, from, to,
    opts?.lang ? { lang: opts.lang } : undefined,
  );
  if (!result.ok) return result;
  return result;
}

/** Return a copy of refMultilevel with nodes matching `pred` set to `kind`. */
function withNodeKind(
  pred: (n: { id: string; kind: string }) => boolean,
  kind: string,
): SiteData {
  return {
    ...refMultilevel,
    graph: {
      ...refMultilevel.graph,
      nodes: refMultilevel.graph.nodes.map((n) =>
        pred(n) ? { ...n, kind: kind as typeof n.kind } : n,
      ),
    },
  };
}

describe('computeWayfinding', () => {
  it('computes route from entrance to RDC destination', () => {
    const r = wf('n-ml-entrance', 'n-ml-dest-rdc');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.route.path.length).toBeGreaterThan(1);
    expect(r.value.steps.length).toBeGreaterThan(1);
    expect(r.value.total_distance_m).toBeGreaterThan(0);
    expect(r.value.level_changes).toBe(0);
  });

  it('computes cross-level route', () => {
    const r = wf('n-ml-entrance', 'n-ml-dest-r1');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.level_changes).toBeGreaterThanOrEqual(1);
  });

  it('generates French instructions by default', () => {
    const r = wf('n-ml-entrance', 'n-ml-dest-rdc');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.steps[0]?.instruction).toContain('Depuis');
    expect(r.value.steps[r.value.steps.length - 1]?.instruction).toContain('Arrivée');
  });

  it('generates English instructions when lang is en', () => {
    const r = wf('n-ml-entrance', 'n-ml-dest-rdc', { lang: 'en' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.steps[0]?.instruction).toContain('From');
    expect(r.value.steps[r.value.steps.length - 1]?.instruction).toContain('Arrival');
  });

  it('generates French instructions when lang is fr', () => {
    const r = wf('n-ml-entrance', 'n-ml-dest-rdc', { lang: 'fr' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.steps[0]?.instruction).toContain('Depuis');
  });

  it('respects accessible profile', () => {
    const r = wf('n-ml-entrance', 'n-ml-dest-r1', { profile: accP });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.steps.map((s) => s.kind)).not.toContain('stair');
  });

  it('returns error for unknown origin node', () => {
    expect(wf('nonexistent', 'n-ml-dest-rdc').ok).toBe(false);
  });

  it('returns error for unknown destination node', () => {
    expect(wf('n-ml-entrance', 'nonexistent').ok).toBe(false);
  });

  it('handles same origin and destination', () => {
    const r = wf('n-ml-entrance', 'n-ml-entrance');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.total_distance_m).toBe(0);
    expect(r.value.level_changes).toBe(0);
  });

  it('each step has level_id', () => {
    const r = wf('n-ml-entrance', 'n-ml-dest-r1');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const step of r.value.steps) expect(step.level_id).toBeTruthy();
  });

  it('is deterministic (INV-4)', () => {
    const r1 = wf('n-ml-entrance', 'n-ml-dest-r1');
    const r2 = wf('n-ml-entrance', 'n-ml-dest-r1');
    expect(r1).toStrictEqual(r2);
  });

  it('English cross-level uses elevator instruction', () => {
    const r = wf('n-ml-entrance', 'n-ml-dest-r1', { lang: 'en' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ins = r.value.steps.map((s) => s.instruction);
    expect(ins.some((i) => i.includes('elevator') || i.includes('stairs'))).toBe(true);
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

    const cP = corridorSite.travel_profiles[0] as TravelProfile;

    it('collapses consecutive junction nodes into a single step', () => {
      const r = wf('n-ent', 'n-dest', { site: corridorSite, profile: cP });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value.steps.length).toBe(3);
    });

    it('collapsed step uses "continue for X m" instruction (fr)', () => {
      const r = wf('n-ent', 'n-dest', { site: corridorSite, profile: cP });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value.steps[1]?.instruction).toContain('Continuer tout droit');
      expect(r.value.steps[1]?.instruction).toContain('20 m');
    });

    it('collapsed step uses "continue straight" instruction (en)', () => {
      const r = wf('n-ent', 'n-dest', { site: corridorSite, profile: cP, lang: 'en' });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value.steps[1]?.instruction).toContain('Continue straight');
      expect(r.value.steps[1]?.instruction).toContain('20 m');
    });

    it('total distance is preserved after collapsing', () => {
      const r = wf('n-ent', 'n-dest', { site: corridorSite, profile: cP });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value.total_distance_m).toBe(40);
    });

    it('collapsed result is deterministic (INV-4)', () => {
      const r1 = wf('n-ent', 'n-dest', { site: corridorSite, profile: cP });
      const r2 = wf('n-ent', 'n-dest', { site: corridorSite, profile: cP });
      expect(r1).toStrictEqual(r2);
    });

    it('single-node junction run keeps continueTowards instruction', () => {
      const makeEdge = (id: string, from: string, to: string) => ({
        id, org_id: 'org1', from_node_id: from, to_node_id: to,
        width_m: 2, slope_pct: 0, accessible: true, direction: 'both' as const, evacuation_route: false, length_m: 10,
      });
      const site: SiteData = { ...corridorSite, graph: { ...corridorSite.graph,
        nodes: corridorSite.graph.nodes.filter((n) => ['n-ent', 'n-j1', 'n-dest'].includes(n.id)),
        edges: [makeEdge('e1', 'n-ent', 'n-j1'), makeEdge('e2', 'n-j1', 'n-dest')],
      } };
      const r = computeWayfinding(site, cP, 'n-ent', 'n-dest');
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value.steps.length).toBe(3);
      const jStep = r.value.steps.find((s) => s.kind === 'junction');
      expect(jStep?.instruction).toContain('Continuer vers');
    });

    it('trailing collapsible run is flushed with continueFor', () => {
      const r = computeWayfinding(corridorSite, cP, 'n-ent', 'n-j3');
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const last = r.value.steps[r.value.steps.length - 1];
      expect(last?.instruction).toContain('20 m');
    });
  });

  describe('instruction templates coverage', () => {
    it('stair without level change uses passby instruction', () => {
      const r = wf('n-ml-entrance', 'n-ml-dest-rdc');
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      for (const s of r.value.steps.filter((s) => s.kind === 'stair')) {
        expect(s.instruction).toContain('Passer devant');
      }
    });

    it('goThrough instruction for non-standard node kinds (fr)', () => {
      const site = withNodeKind((n) => n.id === 'n-ml-hall', 'security_post');
      const r = wf('n-ml-entrance', 'n-ml-dest-rdc', { site, lang: 'fr' });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const sec = r.value.steps.filter((s) => s.kind === 'security_post');
      expect(sec.length).toBeGreaterThan(0);
      expect(sec[0]?.instruction).toContain('Passer par');
    });

    it('goThrough instruction in English', () => {
      const site = withNodeKind((n) => n.id === 'n-ml-hall', 'security_post');
      const r = wf('n-ml-entrance', 'n-ml-dest-rdc', { site, lang: 'en' });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const sec = r.value.steps.filter((s) => s.kind === 'security_post');
      expect(sec.length).toBeGreaterThan(0);
      expect(sec[0]?.instruction).toContain('Go through');
    });

    it('stair with level change uses takeStairs instruction', () => {
      const site = withNodeKind((n) => n.kind === 'elevator', 'stair');
      const r = wf('n-ml-entrance', 'n-ml-dest-r1', { site });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const stairSteps = r.value.steps.filter((s) => s.kind === 'stair');
      expect(stairSteps.length).toBeGreaterThan(0);
      expect(stairSteps[0]?.instruction).toContain('escalier');
    });

    it('escalator with level change uses takeEscalator instruction', () => {
      const site = withNodeKind((n) => n.kind === 'elevator', 'escalator');
      const r = wf('n-ml-entrance', 'n-ml-dest-r1', { site, lang: 'en' });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const esc = r.value.steps.filter((s) => s.kind === 'escalator');
      expect(esc.length).toBeGreaterThan(0);
      expect(esc[0]?.instruction).toContain('Take the escalator');
    });

    it('escalator without level change uses passby instruction', () => {
      const site = withNodeKind((n) => n.id === 'n-ml-hall', 'escalator');
      const r = wf('n-ml-entrance', 'n-ml-dest-rdc', { site, lang: 'en' });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const esc = r.value.steps.filter((s) => s.kind === 'escalator');
      expect(esc.length).toBeGreaterThan(0);
      expect(esc[0]?.instruction).toContain('Pass by');
    });

    it('destination_access mid-route uses passby instruction', () => {
      const site = withNodeKind((n) => n.id === 'n-ml-hall', 'destination_access');
      const r = wf('n-ml-entrance', 'n-ml-dest-rdc', { site, lang: 'en' });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const da = r.value.steps.filter((s) => s.kind === 'destination_access');
      const mid = da.slice(0, -1);
      for (const step of mid) expect(step.instruction).toContain('Pass by');
      expect(da[da.length - 1]?.instruction).toContain('Arrival');
    });

    it('elevator without level change uses passby instruction', () => {
      const site = withNodeKind((n) => n.id === 'n-ml-hall', 'elevator');
      const r = wf('n-ml-entrance', 'n-ml-dest-rdc', { site, lang: 'en' });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const elev = r.value.steps.filter((s) => s.kind === 'elevator');
      expect(elev.length).toBeGreaterThan(0);
      expect(elev[0]?.instruction).toContain('Pass by');
    });

    it('landing node kind produces continueTowards instruction', () => {
      const site = withNodeKind((n) => n.id === 'n-ml-hall', 'landing');
      const r = wf('n-ml-entrance', 'n-ml-dest-rdc', { site, lang: 'fr' });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const land = r.value.steps.filter((s) => s.kind === 'landing');
      expect(land.length).toBeGreaterThan(0);
      expect(land[0]?.instruction).toContain('Continuer vers');
    });
  });
});
