import { eq, inArray } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type {
  SiteData,
  Organization as OrgModel,
  Site as SiteModel,
  Building as BuildingModel,
  Level as LevelModel,
  Footprint as FootprintModel,
  Volume as VolumeModel,
  GraphNode,
  Edge as EdgeModel,
  VerticalLink as VLinkModel,
  Category as CatModel,
  Pictogram as PictoModel,
  Destination as DestModel,
  DestinationName as DNameModel,
  TravelProfile as TPModel,
  NodeKind,
  EdgeDirection,
  VerticalLinkKind,
  OccupancyStatus,
  PictogramRegistry,
  Support as SupportModel,
  SupportType as SupportTypeModel,
  DimensionsSource,
} from '@azimut/core-model';

import { organization } from './schema/org.js';
import { site, building, level, footprint, volume } from './schema/site.js';
import { node, edge, verticalLink } from './schema/graph.js';
import {
  category, pictogram, destination, destinationName,
  travelProfile,
} from './schema/directory.js';
import { support, supportTypology } from './schema/signage.js';

function num(v: string): number {
  return Number(v);
}

export async function loadSiteData(
  db: PostgresJsDatabase,
  orgId: string,
  siteId: string,
): Promise<SiteData> {
  const [orgRow] = await db
    .select()
    .from(organization)
    .where(eq(organization.id, orgId));
  if (!orgRow) throw new Error(`organization ${orgId} not found`);

  const [siteRow] = await db
    .select()
    .from(site)
    .where(eq(site.id, siteId));
  if (!siteRow) throw new Error(`site ${siteId} not found`);

  const buildingRows = await db
    .select()
    .from(building)
    .where(eq(building.site_id, siteId));
  const buildingIds = buildingRows.map((b) => b.id);

  const levelRows = buildingIds.length > 0
    ? await db.select().from(level).where(inArray(level.building_id, buildingIds))
    : [];
  const levelIds = levelRows.map((l) => l.id);

  const [footprintRows, nodeRows, catRows, pictoRows, tpRows, supportRows, typologyRows] =
    await Promise.all([
      levelIds.length > 0
        ? db.select().from(footprint).where(inArray(footprint.level_id, levelIds))
        : Promise.resolve([]),
      levelIds.length > 0
        ? db.select().from(node).where(inArray(node.level_id, levelIds))
        : Promise.resolve([]),
      db.select().from(category).where(eq(category.org_id, orgId)),
      db.select().from(pictogram).where(eq(pictogram.org_id, orgId)),
      db.select().from(travelProfile).where(eq(travelProfile.site_id, siteId)),
      db.select().from(support).where(eq(support.site_id, siteId)),
      db.select().from(supportTypology).where(eq(supportTypology.org_id, orgId)),
    ]);

  const footprintIds = footprintRows.map((f) => f.id);
  const nodeIds = nodeRows.map((n) => n.id);

  const [volumeRows, edgeRows, destRows] = await Promise.all([
    footprintIds.length > 0
      ? db.select().from(volume).where(inArray(volume.footprint_id, footprintIds))
      : Promise.resolve([]),
    nodeIds.length > 0
      ? db.select().from(edge).where(inArray(edge.from_node_id, nodeIds))
      : Promise.resolve([]),
    footprintIds.length > 0
      ? db.select().from(destination).where(inArray(destination.footprint_id, footprintIds))
      : Promise.resolve([]),
  ]);

  const edgeIds = edgeRows.map((e) => e.id);
  const destIds = destRows.map((d) => d.id);

  const [vlinkRows, dnameRows] = await Promise.all([
    edgeIds.length > 0
      ? db.select().from(verticalLink).where(inArray(verticalLink.edge_id, edgeIds))
      : Promise.resolve([]),
    destIds.length > 0
      ? db.select().from(destinationName).where(inArray(destinationName.destination_id, destIds))
      : Promise.resolve([]),
  ]);

  return assembleSiteData(
    orgRow, siteRow, buildingRows, levelRows,
    footprintRows, volumeRows, nodeRows, edgeRows,
    vlinkRows, catRows, pictoRows, destRows, dnameRows, tpRows,
    supportRows, typologyRows,
  );
}

/**
 * Map a `support_typology` row (A5.6) to the in-memory model. The database
 * stores no per-face default dimensions — those live on the support instance —
 * so `faces` is empty; the compiler falls back to the instance dimensions and
 * then a default face size.
 */
export function mapSupportTypologyRow(
  row: typeof supportTypology.$inferSelect,
): SupportTypeModel {
  return {
    id: row.id,
    org_id: row.org_id,
    key: row.key,
    name: row.name,
    face_count: row.face_count,
    ...(row.template_key !== null ? { template_key: row.template_key } : {}),
    faces: [],
  };
}

/**
 * Map a `support` row (A5.6) to the in-memory model. The registry, context and
 * reading-distance columns are additive (migrations 0012/0013) and nullable: a
 * row that predates them falls back to the permissive defaults — the wayfinding
 * registry, the interior context (lowest floor), and a zero reading distance —
 * so an unsurveyed support never silently borrows a stricter rule than its data
 * supports. Real values come from the survey.
 */
export function mapSupportRow(row: typeof support.$inferSelect): SupportModel {
  const dimSource: DimensionsSource | undefined =
    row.dimensions_source === 'overridden' ? 'overridden'
      : row.dimensions_source === 'computed' ? 'computed'
        : undefined;
  return {
    id: row.id,
    org_id: row.org_id,
    site_id: row.site_id,
    node_id: row.node_id,
    registry: row.registry === 'safety' ? 'safety' : 'wayfinding',
    context: row.context === 'exterior' ? 'exterior' : 'interior',
    reading_distance_m: row.reading_distance_m !== null ? num(row.reading_distance_m) : 0,
    azimuth_deg: num(row.azimuth_deg),
    ...(row.width_mm !== null ? { width_mm: row.width_mm } : {}),
    ...(row.height_mm !== null ? { height_mm: row.height_mm } : {}),
    ...(dimSource !== undefined ? { dimensions_source: dimSource } : {}),
  };
}

function assembleSiteData(
  orgRow: typeof organization.$inferSelect,
  siteRow: typeof site.$inferSelect,
  buildingRows: (typeof building.$inferSelect)[],
  levelRows: (typeof level.$inferSelect)[],
  footprintRows: (typeof footprint.$inferSelect)[],
  volumeRows: (typeof volume.$inferSelect)[],
  nodeRows: (typeof node.$inferSelect)[],
  edgeRows: (typeof edge.$inferSelect)[],
  vlinkRows: (typeof verticalLink.$inferSelect)[],
  catRows: (typeof category.$inferSelect)[],
  pictoRows: (typeof pictogram.$inferSelect)[],
  destRows: (typeof destination.$inferSelect)[],
  dnameRows: (typeof destinationName.$inferSelect)[],
  tpRows: (typeof travelProfile.$inferSelect)[],
  supportRows: (typeof support.$inferSelect)[],
  typologyRows: (typeof supportTypology.$inferSelect)[],
): SiteData {
  const org: OrgModel = {
    id: orgRow.id,
    name: orgRow.name,
    slug: orgRow.slug,
  };

  const s: SiteModel = {
    id: siteRow.id,
    org_id: siteRow.org_id,
    name: siteRow.name,
    country_code: siteRow.country_code,
    rules_pack_id: siteRow.rules_pack_id,
  };

  const buildings: BuildingModel[] = buildingRows.map((b) => ({
    id: b.id,
    org_id: b.org_id,
    site_id: b.site_id,
    name: b.name,
    independent_access: b.independent_access,
  }));

  const levels: LevelModel[] = levelRows.map((l) => ({
    id: l.id,
    org_id: l.org_id,
    building_id: l.building_id,
    name: l.name,
    ordinal: l.ordinal,
    elevation_m: num(l.elevation_m),
  }));

  const footprints: FootprintModel[] = footprintRows.map((f) => ({
    id: f.id,
    org_id: f.org_id,
    level_id: f.level_id,
    geometry: f.geometry as FootprintModel['geometry'],
    kind: f.kind,
  }));

  const volumes: VolumeModel[] = volumeRows.map((v) => ({
    id: v.id,
    org_id: v.org_id,
    footprint_id: v.footprint_id,
    base_elevation_m: num(v.base_elevation_m),
    height_m: num(v.height_m),
    material_key: v.material_key,
    render_order: v.render_order,
  }));

  const nodes: GraphNode[] = nodeRows.map((n) => ({
    id: n.id,
    org_id: n.org_id,
    level_id: n.level_id,
    kind: n.kind as NodeKind,
    position: n.position as GraphNode['position'],
    label: n.label,
  }));

  const edges: EdgeModel[] = edgeRows.map((e) => ({
    id: e.id,
    org_id: e.org_id,
    from_node_id: e.from_node_id,
    to_node_id: e.to_node_id,
    width_m: num(e.width_m),
    slope_pct: num(e.slope_pct),
    accessible: e.accessible,
    direction: e.direction as EdgeDirection,
    evacuation_route: e.evacuation_route,
    length_m: num(e.length_m),
  }));

  const vlinks: VLinkModel[] = vlinkRows.map((v) => ({
    id: v.id,
    org_id: v.org_id,
    edge_id: v.edge_id,
    kind: v.kind as VerticalLinkKind,
    capacity: v.capacity,
    accessible: v.accessible,
  }));

  const categories: CatModel[] = catRows.map((c) => ({
    id: c.id,
    org_id: c.org_id,
    sector_key: c.sector_key,
    code: c.code,
    parent_id: c.parent_id,
  }));

  const pictograms: PictoModel[] = pictoRows.map((p) => ({
    id: p.id,
    org_id: p.org_id,
    category_id: p.category_id,
    source: p.source,
    standard_ref: p.standard_ref,
    svg_path: p.svg_path,
    registry: p.registry as PictogramRegistry,
  }));

  const destinations: DestModel[] = destRows.map((d) => ({
    id: d.id,
    org_id: d.org_id,
    footprint_id: d.footprint_id,
    node_id: d.node_id,
    category_id: d.category_id,
    occupant_name: d.occupant_name,
    occupancy_status: d.occupancy_status as OccupancyStatus,
    display_priority: d.display_priority,
  }));

  const dnames: DNameModel[] = dnameRows.map((dn) => ({
    id: dn.id,
    org_id: dn.org_id,
    destination_id: dn.destination_id,
    lang: dn.lang as DNameModel['lang'],
    value: dn.value,
  }));

  const tprofiles: TPModel[] = tpRows.map((tp) => ({
    id: tp.id,
    org_id: tp.org_id,
    site_id: tp.site_id,
    key: tp.key,
    name: tp.name,
    excluded_edge_kinds: tp.excluded_edge_kinds as readonly string[],
    require_accessible: tp.require_accessible,
    honor_hours: tp.honor_hours,
  }));

  return {
    organization: org,
    site: s,
    buildings,
    levels,
    footprints,
    volumes,
    graph: { nodes, edges, vertical_links: vlinks },
    categories,
    pictograms,
    destinations,
    destination_names: dnames,
    travel_profiles: tprofiles,
    support_types: typologyRows.map(mapSupportTypologyRow),
    supports: supportRows.map(mapSupportRow),
    face_templates: [],
  };
}
