import type { SiteData, TravelProfile, Outcome } from '@azimut/core-model';
import { computeRoute, type Route } from './compute-route.js';
import { computeInputsHash } from './compute-hashes.js';

type CacheKey = string;

type CacheEntry = {
  readonly route: Route;
  readonly inputs_hash: string;
};

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
    // D7.2 — une seule implantation : le cache s'invalide sur l'empreinte
    // des entrées de D7.1, et non sur une chaîne composée à part.
    const inputs = computeInputsHash(site, profile);
    if (!inputs.ok) return inputs;
    const currentHash = inputs.value;

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
