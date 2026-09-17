import type {
  SiteData,
  Organization,
  Site,
  Building,
  Level,
  Footprint,
  Volume,
  GraphNode,
  Edge,
  VerticalLink,
  Category,
  Pictogram,
  Destination,
  DestinationName,
  TravelProfile,
} from '@azimut/core-model';

/**
 * D10.5 — Rehydrate a {@link SiteData} from the kiosk deployment tree's data
 * files, so the runtime operates entirely offline on the bytes shipped in the
 * package (no network, no database).
 *
 * The inverse of `buildKioskDataFiles` in @azimut/compiler: it reads
 * `data/graph.json`, `data/directory.json`, `data/scene.json` and
 * `data/site.json`. Panel-authoring collections (support types, face
 * templates) are not shipped to a kiosk and come back empty — the runtime does
 * not render supports.
 *
 * Throws on a missing file or a structurally invalid document. Byte integrity
 * is the package manifest's responsibility (D10.2); this loader guards shape.
 */

const decoder = new TextDecoder();

function readJson(
  files: ReadonlyMap<string, Uint8Array>,
  path: string,
): Record<string, unknown> {
  const bytes = files.get(path);
  if (bytes === undefined) {
    throw new Error(`Kiosk data file missing: ${path}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoder.decode(bytes));
  } catch (cause) {
    throw new Error(`Kiosk data file is not valid JSON: ${path}`, { cause });
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Kiosk data file is not a JSON object: ${path}`);
  }
  return parsed as Record<string, unknown>;
}

function readArray(
  doc: Record<string, unknown>,
  key: string,
  path: string,
): unknown[] {
  const value = doc[key];
  if (!Array.isArray(value)) {
    throw new Error(`Kiosk data file ${path} is missing array field "${key}"`);
  }
  return value;
}

function readObject(
  doc: Record<string, unknown>,
  key: string,
  path: string,
): Record<string, unknown> {
  const value = doc[key];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Kiosk data file ${path} is missing object field "${key}"`);
  }
  return value as Record<string, unknown>;
}

export function loadKioskSite(
  files: ReadonlyMap<string, Uint8Array>,
): SiteData {
  const graphDoc = readJson(files, 'data/graph.json');
  const directoryDoc = readJson(files, 'data/directory.json');
  const sceneDoc = readJson(files, 'data/scene.json');
  const identityDoc = readJson(files, 'data/site.json');

  const graph = {
    nodes: readArray(graphDoc, 'nodes', 'data/graph.json') as GraphNode[],
    edges: readArray(graphDoc, 'edges', 'data/graph.json') as Edge[],
    vertical_links: readArray(
      graphDoc,
      'vertical_links',
      'data/graph.json',
    ) as VerticalLink[],
  };

  return {
    organization: readObject(
      identityDoc,
      'organization',
      'data/site.json',
    ) as unknown as Organization,
    site: readObject(identityDoc, 'site', 'data/site.json') as unknown as Site,
    buildings: readArray(sceneDoc, 'buildings', 'data/scene.json') as Building[],
    levels: readArray(sceneDoc, 'levels', 'data/scene.json') as Level[],
    footprints: readArray(
      sceneDoc,
      'footprints',
      'data/scene.json',
    ) as Footprint[],
    volumes: readArray(sceneDoc, 'volumes', 'data/scene.json') as Volume[],
    graph,
    categories: readArray(
      directoryDoc,
      'categories',
      'data/directory.json',
    ) as Category[],
    pictograms: readArray(
      directoryDoc,
      'pictograms',
      'data/directory.json',
    ) as Pictogram[],
    destinations: readArray(
      directoryDoc,
      'destinations',
      'data/directory.json',
    ) as Destination[],
    destination_names: readArray(
      directoryDoc,
      'destination_names',
      'data/directory.json',
    ) as DestinationName[],
    travel_profiles: readArray(
      identityDoc,
      'travel_profiles',
      'data/site.json',
    ) as TravelProfile[],
    // Not shipped to a kiosk: a terminal draws from metric geometry, never
    // from a raster background, so the plan sources and their calibrations
    // stay in the studio. A kiosk site is consequently not a site `runChecks`
    // can judge — N1.4's calibration check would flag every level.
    plan_sources: [],
    plan_calibrations: [],
    // Not shipped to a kiosk: supports and panels are authored, not displayed
    // on a wayfinding terminal.
    support_types: [],
    supports: [],
    support_faces: [],
    content_blocks: [],
    support_versions: [],
    face_templates: [],
  };
}
