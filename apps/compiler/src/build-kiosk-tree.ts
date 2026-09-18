import type { SiteData } from '@azimut/core-model';
import { canonicalSerialize } from '@azimut/core-model';
import { renderFloorPlan } from '@azimut/engine-layout';
import type { FloorPlanOptions, FloorPlanTheme } from '@azimut/engine-layout';
import { themePapier, stateColorsPapier } from '@azimut/design-tokens';
import type { AssetStore } from './asset-store.js';

/**
 * D10.1 — Build the kiosk deployment tree files from the site.
 *
 * Produces the deterministic `data/*.json` and `maps/level-<ordinal>.svg`
 * files and merges them with the provided runtime app assets (index.html,
 * app.js, app.css and any embedded fonts). The result feeds
 * assembleKioskPackage, which validates the tree and builds the manifest.
 *
 * The runtime app itself is not generated here — it is the built kiosk-runtime
 * bundle, supplied as bytes. Colours come from the design-tokens module (the
 * single source of truth), never hardcoded.
 */

export type KioskAppAssets = {
  readonly indexHtml: Uint8Array;
  readonly appJs: Uint8Array;
  readonly appCss: Uint8Array;
  /** Extra assets under the tree (e.g. fonts), keyed by relative path. */
  readonly extra?: ReadonlyMap<string, Uint8Array>;
};

const encoder = new TextEncoder();
function utf8(s: string): Uint8Array {
  return encoder.encode(s);
}

const KIOSK_FLOOR_THEME: FloorPlanTheme = {
  background: themePapier['surface-page'],
  footprint_fill: themePapier['surface-panel'],
  footprint_stroke: themePapier['border-hairline'],
  // Le parking est du sol, pas du bâti : une surface en creux sous les
  // empreintes, avec un contour plus affirmé pour que la limite se lise.
  parking_fill: themePapier['surface-sunken'],
  parking_stroke: themePapier['border-strong'],
  edge_stroke: themePapier['text-secondary'],
  edge_evacuation_stroke: stateColorsPapier['state-valid'],
  node_fill: themePapier['accent'],
  node_stroke: themePapier['accent'],
  node_safety_fill: stateColorsPapier['state-blocking'],
  text_primary: themePapier['text-primary'],
  text_secondary: themePapier['text-secondary'],
};

const FLOOR_OPTS: Omit<FloorPlanOptions, 'theme'> = {
  width_px: 1000,
  height_px: 700,
  font_family: 'system-ui, sans-serif',
  show_destinations: true,
  show_edges: true,
  padding_px: 40,
};

/**
 * Deterministic `data/*.json` files derived from the site. Together they carry
 * everything the kiosk runtime consumes offline: the routing graph, the
 * searchable directory (with pictograms), the scene geometry, and the site
 * identity plus travel profiles. Panel-authoring collections (support types,
 * face templates) are intentionally not shipped — a kiosk renders maps and
 * wayfinding, not supports. `loadKioskSite` in @azimut/kiosk-runtime rehydrates
 * a SiteData from exactly these files.
 */
export function buildKioskDataFiles(site: SiteData): Map<string, Uint8Array> {
  const graph = canonicalSerialize({
    nodes: site.graph.nodes,
    edges: site.graph.edges,
    vertical_links: site.graph.vertical_links,
  });
  const directory = canonicalSerialize({
    destinations: site.destinations,
    destination_names: site.destination_names,
    categories: site.categories,
    pictograms: site.pictograms,
  });
  const scene = canonicalSerialize({
    buildings: site.buildings,
    levels: site.levels,
    footprints: site.footprints,
    volumes: site.volumes,
  });
  const identity = canonicalSerialize({
    organization: site.organization,
    site: site.site,
    travel_profiles: site.travel_profiles,
  });
  return new Map<string, Uint8Array>([
    ['data/graph.json', utf8(graph)],
    ['data/directory.json', utf8(directory)],
    ['data/scene.json', utf8(scene)],
    ['data/site.json', utf8(identity)],
  ]);
}

/**
 * One `maps/level-<ordinal>.svg` per level, rendered deterministically with
 * design-token colours. Fails if a level cannot be rendered.
 */
export function buildKioskMapFiles(site: SiteData): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  const levels = [...site.levels].sort((a, b) => a.ordinal - b.ordinal);
  for (const level of levels) {
    const rendered = renderFloorPlan(site, level.id, {
      ...FLOOR_OPTS,
      theme: KIOSK_FLOOR_THEME,
    });
    if (!rendered.ok) {
      const codes = rendered.findings.map((f) => f.code).join(', ');
      throw new Error(`Floor plan render failed for level ${level.id}: ${codes}`);
    }
    files.set(`maps/level-${level.ordinal}.svg`, utf8(rendered.value));
  }
  return files;
}

/** Add the generated data and map files for the site to a tree in place. */
function addGeneratedFiles(tree: Map<string, Uint8Array>, site: SiteData): void {
  for (const [path, bytes] of buildKioskDataFiles(site)) tree.set(path, bytes);
  for (const [path, bytes] of buildKioskMapFiles(site)) tree.set(path, bytes);
}

/** Assemble the full kiosk tree: app assets + generated data + maps. */
export function buildKioskTree(
  site: SiteData,
  appAssets: KioskAppAssets,
): ReadonlyMap<string, Uint8Array> {
  const tree = new Map<string, Uint8Array>();
  tree.set('index.html', appAssets.indexHtml);
  tree.set('assets/app.js', appAssets.appJs);
  tree.set('assets/app.css', appAssets.appCss);
  for (const [path, bytes] of appAssets.extra ?? new Map()) {
    tree.set(path, bytes);
  }
  addGeneratedFiles(tree, site);
  return tree;
}

/**
 * Assemble the kiosk tree by reading the runtime app bundle from a storage
 * port (index.html plus everything under `assets/`) and generating the
 * per-site data and map files in-process. This is the production path: the
 * static bundle lives in storage, the site-derived files are computed here.
 */
export async function buildKioskTreeFromStore(
  site: SiteData,
  store: AssetStore,
): Promise<ReadonlyMap<string, Uint8Array>> {
  const tree = new Map<string, Uint8Array>();
  const bundlePaths = ['index.html', ...(await store.list('assets/'))];
  for (const path of bundlePaths) {
    tree.set(path, await store.read(path));
  }
  addGeneratedFiles(tree, site);
  return tree;
}
