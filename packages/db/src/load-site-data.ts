import { eq, inArray } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { SiteData } from '@azimut/core-model';

import { organization } from './schema/org.js';
import {
  site, building, level, footprint, volume, planSource, planCalibration,
  zone, parkingSpace,
} from './schema/site.js';
import { node, edge, verticalLink, buildingLink } from './schema/graph.js';
import {
  category, pictogram, destination, destinationName,
  travelProfile,
} from './schema/directory.js';
import {
  support, supportTypology, supportFace, supportContentBlock, supportVersion,
} from './schema/signage.js';
import { assembleSiteData } from './mapping/index.js';

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

  const [
    footprintRows, planSourceRows, nodeRows, catRows, pictoRows, tpRows,
    supportRows, typologyRows,
  ] =
    await Promise.all([
      levelIds.length > 0
        ? db.select().from(footprint).where(inArray(footprint.level_id, levelIds))
        : Promise.resolve([]),
      levelIds.length > 0
        ? db.select().from(planSource).where(inArray(planSource.level_id, levelIds))
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
  const planSourceIds = planSourceRows.map((p) => p.id);

  const [volumeRows, edgeRows, destRows, calibrationRows] = await Promise.all([
    footprintIds.length > 0
      ? db.select().from(volume).where(inArray(volume.footprint_id, footprintIds))
      : Promise.resolve([]),
    nodeIds.length > 0
      ? db.select().from(edge).where(inArray(edge.from_node_id, nodeIds))
      : Promise.resolve([]),
    footprintIds.length > 0
      ? db.select().from(destination).where(inArray(destination.footprint_id, footprintIds))
      : Promise.resolve([]),
    planSourceIds.length > 0
      ? db.select().from(planCalibration).where(inArray(planCalibration.plan_source_id, planSourceIds))
      : Promise.resolve([]),
  ]);

  const edgeIds = edgeRows.map((e) => e.id);
  const destIds = destRows.map((d) => d.id);
  const supportIds = supportRows.map((s) => s.id);

  const [vlinkRows, blinkRows, dnameRows, faceRows, versionRows] = await Promise.all([
    edgeIds.length > 0
      ? db.select().from(verticalLink).where(inArray(verticalLink.edge_id, edgeIds))
      : Promise.resolve([]),
    // M01.S10 : les liaisons inter-bâtiments se lisent par leurs arêtes, comme
    // les liaisons verticales. La table existait en base sans que rien ne la
    // charge, et la règle qui la rend obligatoire n'avait donc rien à lire.
    edgeIds.length > 0
      ? db.select().from(buildingLink).where(inArray(buildingLink.edge_id, edgeIds))
      : Promise.resolve([]),
    destIds.length > 0
      ? db.select().from(destinationName).where(inArray(destinationName.destination_id, destIds))
      : Promise.resolve([]),
    supportIds.length > 0
      ? db.select().from(supportFace).where(inArray(supportFace.support_id, supportIds))
      : Promise.resolve([]),
    supportIds.length > 0
      ? db.select().from(supportVersion).where(inArray(supportVersion.support_id, supportIds))
      : Promise.resolve([]),
  ]);

  const faceIds = faceRows.map((f) => f.id);
  const blockRows = faceIds.length > 0
    ? await db.select().from(supportContentBlock).where(inArray(supportContentBlock.face_id, faceIds))
    : [];

  // A5.2 — les zones du socle. Elles pendent au niveau, comme les empreintes
  // qu'elles déclarent couvrir. Section S8 : un parking est une zone, et c'est
  // par ici que les contrôles du domaine `PARK` le voient désormais.
  const [zoneRows, parkingSpaceRows] = await Promise.all([
    levelIds.length > 0
      ? db.select().from(zone).where(inArray(zone.level_id, levelIds))
      : Promise.resolve([]),
    // A5.3 — l'extension des empreintes de place, qui pend à l'empreinte.
    footprintIds.length > 0
      ? db.select().from(parkingSpace)
        .where(inArray(parkingSpace.footprint_id, footprintIds))
      : Promise.resolve([]),
  ]);

  return assembleSiteData({
    organization: orgRow,
    site: siteRow,
    buildings: buildingRows,
    levels: levelRows,
    plan_sources: planSourceRows,
    plan_calibrations: calibrationRows,
    footprints: footprintRows,
    volumes: volumeRows,
    nodes: nodeRows,
    edges: edgeRows,
    vertical_links: vlinkRows,
    building_links: blinkRows,
    categories: catRows,
    pictograms: pictoRows,
    destinations: destRows,
    destination_names: dnameRows,
    travel_profiles: tpRows,
    supports: supportRows,
    support_typologies: typologyRows,
    support_faces: faceRows,
    content_blocks: blockRows,
    support_versions: versionRows,
    zones: zoneRows,
    parking_spaces: parkingSpaceRows,
  });
}
