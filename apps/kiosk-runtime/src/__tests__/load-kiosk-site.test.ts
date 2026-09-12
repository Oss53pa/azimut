import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit';
import { canonicalSerialize } from '@azimut/core-model';
import type { SiteData } from '@azimut/core-model';
import { loadKioskSite } from '../load-kiosk-site.js';
import { searchDestinations } from '../search-destinations.js';
import { computeWayfinding } from '../wayfinding-session.js';

const enc = new TextEncoder();

/**
 * Build the kiosk `data/*.json` files exactly as @azimut/compiler's
 * buildKioskDataFiles does. Kept here (rather than importing the compiler) to
 * keep the runtime decoupled from the producer while still exercising the real
 * canonical serialization format the loader must accept.
 */
function kioskDataFiles(site: SiteData): Map<string, Uint8Array> {
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

describe('D10.5 — loadKioskSite rehydrates a SiteData from the tree', () => {
  it('reconstructs the shipped collections and site identity', () => {
    const loaded = loadKioskSite(kioskDataFiles(refMultilevel));

    expect(loaded.site).toEqual(refMultilevel.site);
    expect(loaded.organization).toEqual(refMultilevel.organization);
    expect(loaded.graph.nodes).toEqual(refMultilevel.graph.nodes);
    expect(loaded.graph.edges).toEqual(refMultilevel.graph.edges);
    expect(loaded.destinations).toEqual(refMultilevel.destinations);
    expect(loaded.destination_names).toEqual(refMultilevel.destination_names);
    expect(loaded.pictograms).toEqual(refMultilevel.pictograms);
    expect(loaded.travel_profiles).toEqual(refMultilevel.travel_profiles);
    expect(loaded.levels).toEqual(refMultilevel.levels);
  });

  it('does not ship panel-authoring collections', () => {
    const loaded = loadKioskSite(kioskDataFiles(refMultilevel));
    expect(loaded.support_types).toEqual([]);
    expect(loaded.face_templates).toEqual([]);
  });

  it('search on the rehydrated site matches the original (autonomous)', () => {
    const loaded = loadKioskSite(kioskDataFiles(refMultilevel));
    for (const lang of ['fr', 'en'] as const) {
      const q = lang === 'fr' ? 'Bureau' : 'office';
      expect(searchDestinations(loaded, q, lang, 5)).toEqual(
        searchDestinations(refMultilevel, q, lang, 5),
      );
    }
  });

  it('wayfinding on the rehydrated site matches the original', () => {
    const loaded = loadKioskSite(kioskDataFiles(refMultilevel));
    const profile = refMultilevel.travel_profiles.find((p) => p.key === 'standard');
    if (!profile) throw new Error('missing profile');
    const target = searchDestinations(refMultilevel, 'Bureau', 'fr', 1)[0];
    if (!target) throw new Error('no destination matched');

    const onLoaded = computeWayfinding(
      loaded, profile, 'n-ml-hall', target.destination.node_id, { lang: 'fr' },
    );
    const onOriginal = computeWayfinding(
      refMultilevel, profile, 'n-ml-hall', target.destination.node_id, { lang: 'fr' },
    );
    expect(onLoaded.ok).toBe(true);
    expect(onLoaded).toEqual(onOriginal);
  });

  it('throws when a required data file is missing', () => {
    const files = kioskDataFiles(refMultilevel);
    files.delete('data/site.json');
    expect(() => loadKioskSite(files)).toThrow('data/site.json');
  });

  it('throws on a structurally invalid document', () => {
    const files = kioskDataFiles(refMultilevel);
    files.set('data/graph.json', enc.encode('{"nodes":[],"edges":[]}'));
    expect(() => loadKioskSite(files)).toThrow('vertical_links');
  });

  it('throws on non-JSON bytes', () => {
    const files = kioskDataFiles(refMultilevel);
    files.set('data/directory.json', enc.encode('not json at all'));
    expect(() => loadKioskSite(files)).toThrow('not valid JSON');
  });
});
