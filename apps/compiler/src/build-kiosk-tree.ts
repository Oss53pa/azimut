import type { Finding, Outcome, SiteData } from '@azimut/core-model';
import { canonicalSerialize, codePointCompare } from '@azimut/core-model';
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
  // Une surface non numérisée se lit comme un avertissement, pas comme un objet.
  undigitized_fill: themePapier['surface-canvas'],
  undigitized_stroke: stateColorsPapier['state-warning'],
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
 * D10.0 — une marque de sécurité omise faute de fonction désignée.
 *
 * `PICTO.FUNCTION_NOT_DESIGNATED` est un avertissement au catalogue : un plan
 * d'atelier se rend sans la marque et le dit. Sur une borne, personne ne lit
 * l'avertissement, et « la borne est le dernier endroit où une information de
 * sécurité peut manquer sans que personne le voie ». L'assemblage refuse donc.
 */
function isOmittedSafetyMark(finding: Finding): boolean {
  return finding.code === 'PICTO.FUNCTION_NOT_DESIGNATED'
    && finding.params['registry'] === 'safety';
}

/**
 * One `maps/level-<ordinal>.svg` per level, rendered deterministically with
 * design-token colours.
 *
 * D10.0 — « l'assemblage d'un paquet agrège les anomalies de chaque rendu
 * qu'il embarque, et ne lit jamais le seul succès ». Chaque niveau est rendu,
 * et ses anomalies sont rassemblées, dans l'ordre des niveaux, avec le niveau
 * qui les porte (`level_id`) : la même marque manquante sur deux niveaux fait
 * deux anomalies, pas une. Le paquet est refusé si un rendu échoue ou si une
 * marque de sécurité manque ; sinon les avertissements voyagent avec lui.
 */
export function buildKioskMapFiles(site: SiteData): Outcome<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>();
  const findings: Finding[] = [];
  let refused = false;
  const levels = [...site.levels]
    .sort((a, b) => a.ordinal - b.ordinal || codePointCompare(a.id, b.id));
  for (const level of levels) {
    const rendered = renderFloorPlan(site, level.id, {
      ...FLOOR_OPTS,
      theme: KIOSK_FLOOR_THEME,
    });
    const raised = rendered.ok ? rendered.warnings : rendered.findings;
    for (const finding of raised) {
      findings.push({ ...finding, params: { ...finding.params, level_id: level.id } });
      if (isOmittedSafetyMark(finding)) refused = true;
    }
    if (!rendered.ok) {
      refused = true;
      continue;
    }
    files.set(`maps/level-${level.ordinal}.svg`, utf8(rendered.value));
  }
  return refused ? { ok: false, findings } : { ok: true, value: files, warnings: findings };
}

/**
 * Add the generated data and map files for the site to a tree in place, or
 * refuse with the anomalies of the map renders (D10.0).
 */
function addGeneratedFiles(
  tree: Map<string, Uint8Array>,
  site: SiteData,
): Outcome<ReadonlyMap<string, Uint8Array>> {
  const maps = buildKioskMapFiles(site);
  if (!maps.ok) return maps;
  for (const [path, bytes] of buildKioskDataFiles(site)) tree.set(path, bytes);
  for (const [path, bytes] of maps.value) tree.set(path, bytes);
  return { ok: true, value: tree, warnings: maps.warnings };
}

/** Assemble the full kiosk tree: app assets + generated data + maps. */
export function buildKioskTree(
  site: SiteData,
  appAssets: KioskAppAssets,
): Outcome<ReadonlyMap<string, Uint8Array>> {
  const tree = new Map<string, Uint8Array>();
  tree.set('index.html', appAssets.indexHtml);
  tree.set('assets/app.js', appAssets.appJs);
  tree.set('assets/app.css', appAssets.appCss);
  for (const [path, bytes] of appAssets.extra ?? new Map()) {
    tree.set(path, bytes);
  }
  return addGeneratedFiles(tree, site);
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
): Promise<Outcome<ReadonlyMap<string, Uint8Array>>> {
  const tree = new Map<string, Uint8Array>();
  const bundlePaths = ['index.html', ...(await store.list('assets/'))];
  for (const path of bundlePaths) {
    tree.set(path, await store.read(path));
  }
  return addGeneratedFiles(tree, site);
}
