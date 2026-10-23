import { canonicalSerialize } from '@azimut/core-model';
import type { SiteData } from '@azimut/core-model';

const enc = new TextEncoder();

/**
 * Build the kiosk `data/*.json` files exactly as @azimut/compiler's
 * buildKioskDataFiles does. Kept here (rather than importing the compiler) to
 * keep the runtime decoupled from the producer while still exercising the real
 * canonical serialization format the loader must accept.
 */
export function kioskDataFiles(site: SiteData): Map<string, Uint8Array> {
  return new Map<string, Uint8Array>([
    [
      'data/graph.json',
      enc.encode(
        canonicalSerialize({
          nodes: site.graph.nodes,
          edges: site.graph.edges,
          vertical_links: site.graph.vertical_links,
        }),
      ),
    ],
    [
      'data/directory.json',
      enc.encode(
        canonicalSerialize({
          destinations: site.destinations,
          destination_names: site.destination_names,
          categories: site.categories,
          pictograms: site.pictograms,
        }),
      ),
    ],
    [
      'data/scene.json',
      enc.encode(
        canonicalSerialize({
          buildings: site.buildings,
          levels: site.levels,
          footprints: site.footprints,
          volumes: site.volumes,
        }),
      ),
    ],
    [
      'data/site.json',
      enc.encode(
        canonicalSerialize({
          organization: site.organization,
          site: site.site,
          travel_profiles: site.travel_profiles,
        }),
      ),
    ],
  ]);
}
