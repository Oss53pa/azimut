import { eq, inArray } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { SiteData } from '@azimut/core-model';

import { organization } from './schema/org.js';
import {
  site, building, level, footprint, volume,
  parking, parkingSpace, parkingUncoveredArea, vehicleGate,
} from './schema/site.js';
import { node, edge, verticalLink } from './schema/graph.js';
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
  const supportIds = supportRows.map((s) => s.id);

  const [vlinkRows, dnameRows, faceRows, versionRows] = await Promise.all([
    edgeIds.length > 0
      ? db.select().from(verticalLink).where(inArray(verticalLink.edge_id, edgeIds))
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

  // Complément atelier M2 — stationnement. Les places et les zones non
  // couvertes pendent aux parkings : sans parking, aucune requête.
  const [parkingRows, gateRows] = await Promise.all([
    levelIds.length > 0
      ? db.select().from(parking).where(inArray(parking.level_id, levelIds))
      : Promise.resolve([]),
    levelIds.length > 0
      ? db.select().from(vehicleGate).where(inArray(vehicleGate.level_id, levelIds))
      : Promise.resolve([]),
  ]);
  const parkingIds = parkingRows.map((p) => p.id);

  const [parkingSpaceRows, uncoveredRows] = await Promise.all([
    parkingIds.length > 0
      ? db.select().from(parkingSpace).where(inArray(parkingSpace.parking_id, parkingIds))
      : Promise.resolve([]),
    parkingIds.length > 0
      ? db.select().from(parkingUncoveredArea).where(inArray(parkingUncoveredArea.parking_id, parkingIds))
      : Promise.resolve([]),
  ]);

  return assembleSiteData({
    organization: orgRow,
    site: siteRow,
    buildings: buildingRows,
    levels: levelRows,
    footprints: footprintRows,
    volumes: volumeRows,
    nodes: nodeRows,
    edges: edgeRows,
    vertical_links: vlinkRows,
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
    parkings: parkingRows,
    parking_spaces: parkingSpaceRows,
    parking_uncovered: uncoveredRows,
    vehicle_gates: gateRows,
  });
}
