import { describe, it, expect } from 'vitest';
import {
  allReferenceSites,
  refMinimal,
  refBroken,
  refAdversarial,
  refMultilevel,
  siteChecksum,
} from '../index.js';

describe('reference sites', () => {
  it('loads all reference sites', () => {
    expect(allReferenceSites.size).toBe(4);
    expect(allReferenceSites.get('ref-minimal')).toBe(refMinimal);
    expect(allReferenceSites.get('ref-broken')).toBe(refBroken);
    expect(allReferenceSites.get('ref-adversarial')).toBe(refAdversarial);
    expect(allReferenceSites.get('ref-multilevel')).toBe(refMultilevel);
  });

  for (const [key, site] of allReferenceSites) {
    describe(key, () => {
      it('has a stable checksum', () => {
        const c1 = siteChecksum(site);
        const c2 = siteChecksum(site);
        expect(c1).toBe(c2);
        expect(c1).toMatch(/^[a-f0-9]{64}$/);
      });

      it('has required top-level fields', () => {
        expect(site.organization.id).toBeTruthy();
        expect(site.site.id).toBeTruthy();
        expect(site.site.org_id).toBe(site.organization.id);
        expect(site.buildings.length).toBeGreaterThan(0);
        expect(site.levels.length).toBeGreaterThan(0);
      });

      it('has consistent org_id across all entities', () => {
        const orgId = site.organization.id;
        for (const b of site.buildings) {
          expect(b.org_id).toBe(orgId);
        }
        for (const l of site.levels) {
          expect(l.org_id).toBe(orgId);
        }
        for (const n of site.graph.nodes) {
          expect(n.org_id).toBe(orgId);
        }
        for (const e of site.graph.edges) {
          expect(e.org_id).toBe(orgId);
        }
        for (const d of site.destinations) {
          expect(d.org_id).toBe(orgId);
        }
      });
    });
  }
});

describe('ref-minimal specifics', () => {
  it('has 4 destinations', () => {
    expect(refMinimal.destinations.length).toBe(4);
  });

  it('has a connected graph', () => {
    expect(refMinimal.graph.nodes.length).toBe(6);
    expect(refMinimal.graph.edges.length).toBe(5);
  });
});

describe('ref-broken specifics', () => {
  it('has an orphan node', () => {
    const nodeIds = new Set(refBroken.graph.nodes.map((n) => n.id));
    const connectedIds = new Set<string>();
    for (const e of refBroken.graph.edges) {
      connectedIds.add(e.from_node_id);
      connectedIds.add(e.to_node_id);
    }
    const orphans = [...nodeIds].filter((id) => !connectedIds.has(id));
    expect(orphans.length).toBeGreaterThan(0);
  });

  it('has a self-referencing edge (zero-length loop)', () => {
    const selfEdge = refBroken.graph.edges.find(
      (e) => e.from_node_id === e.to_node_id,
    );
    expect(selfEdge).toBeDefined();
  });

  it('has a disconnected subgraph', () => {
    const reachable = new Set<string>();
    const entrance = refBroken.graph.nodes.find(
      (n) => n.kind === 'entrance',
    );
    if (!entrance) throw new Error('no entrance');

    const queue = [entrance.id];
    while (queue.length > 0) {
      const current = queue.pop();
      if (current === undefined) break;
      if (reachable.has(current)) continue;
      reachable.add(current);
      for (const e of refBroken.graph.edges) {
        if (e.from_node_id === current && !reachable.has(e.to_node_id)) {
          queue.push(e.to_node_id);
        }
        if (e.to_node_id === current && !reachable.has(e.from_node_id)) {
          queue.push(e.from_node_id);
        }
      }
    }

    const allIds = new Set(refBroken.graph.nodes.map((n) => n.id));
    const unreachable = [...allIds].filter((id) => !reachable.has(id));
    expect(unreachable.length).toBeGreaterThan(0);
  });

  it('has a cross-level edge without vertical link', () => {
    const nodeLevel = new Map(
      refBroken.graph.nodes.map((n) => [n.id, n.level_id]),
    );
    const crossLevel = refBroken.graph.edges.filter((e) => {
      const fromLevel = nodeLevel.get(e.from_node_id);
      const toLevel = nodeLevel.get(e.to_node_id);
      return fromLevel !== toLevel;
    });
    expect(crossLevel.length).toBeGreaterThan(0);

    const edgesWithVl = new Set(
      refBroken.graph.vertical_links.map((vl) => vl.edge_id),
    );
    const crossWithoutVl = crossLevel.filter(
      (e) => !edgesWithVl.has(e.id),
    );
    expect(crossWithoutVl.length).toBeGreaterThan(0);
  });
});
