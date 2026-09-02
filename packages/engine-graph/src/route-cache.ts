import type { SiteData, TravelProfile, Outcome } from '@azimut/core-model';
import { computeRoute, type Route } from './compute-route.js';

type CacheKey = string;

type CacheEntry = {
  readonly route: Route;
  readonly inputs_hash: string;
};

function hashInputs(site: SiteData, profileId: string): string {
  const edgeParts = [...site.graph.edges]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(
      (e) =>
        `${e.id}:${e.from_node_id}:${e.to_node_id}:${e.length_m}:${e.accessible}:${e.direction}`,
    );
  const nodeParts = [...site.graph.nodes]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((n) => `${n.id}:${n.level_id}`);
  const vlParts = [...site.graph.vertical_links]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((vl) => `${vl.id}:${vl.edge_id}:${vl.accessible}`);

  return [profileId, ...nodeParts, ...edgeParts, ...vlParts].join('|');
}

function makeCacheKey(
  profileId: string,
  from: string,
  to: string,
): CacheKey {
  return `${profileId}:${from}:${to}`;
}

export class RouteCache {
  private readonly cache = new Map<CacheKey, CacheEntry>();

  computeOrGet(
    site: SiteData,
    profile: TravelProfile,
    from: string,
    to: string,
  ): Outcome<Route> {
    const key = makeCacheKey(profile.id, from, to);
    const currentHash = hashInputs(site, profile.id);

    const cached = this.cache.get(key);
    if (cached && cached.inputs_hash === currentHash) {
      return { ok: true, value: cached.route, warnings: [] };
    }

    const result = computeRoute(site, profile, from, to);
    if (result.ok) {
      this.cache.set(key, {
        route: result.value,
        inputs_hash: currentHash,
      });
    }

    return result;
  }

  invalidateForEdge(edgeId: string): void {
    const toDelete: CacheKey[] = [];
    for (const [key, entry] of this.cache) {
      if (entry.route.edges.includes(edgeId)) {
        toDelete.push(key);
      }
    }
    for (const key of toDelete) {
      this.cache.delete(key);
    }
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
