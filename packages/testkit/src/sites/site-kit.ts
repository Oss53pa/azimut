import type { NodeKind, SiteData, VerticalLinkKind } from '@azimut/core-model';
import { edgeLengthBetween } from '@azimut/core-model';

/**
 * C1 — l'outillage commun aux sites de référence `ref-health`, `ref-transit`
 * et `ref-campus`.
 *
 * Une seule chose y est calculée : la longueur d'une arête, depuis la position
 * de ses deux nœuds et l'altitude de leurs niveaux, par la fonction même que la
 * relecture emploie (M01.S6, `edgeLengthBetween`). Écrite à la main, elle
 * finirait par ne plus concorder avec ce que le site relu rend.
 *
 * Données construites. Aucun plan, aucune enseigne, aucune donnée client
 * réelle (A13.1).
 */
export const ORG = 'org-test-001';

type Node = SiteData['graph']['nodes'][number];
type Edge = SiteData['graph']['edges'][number];
type Level = SiteData['levels'][number];

export type EdgeOptions = {
  readonly slope_pct?: number;
  readonly accessible?: boolean;
  readonly evacuation_route?: boolean;
  readonly direction?: Edge['direction'];
};

export function siteKit(siteId: string, day: string) {
  const node = (id: string, levelId: string, kind: NodeKind, x: number, y: number, label: string): Node =>
    ({ id, org_id: ORG, level_id: levelId, kind, position: { x_m: x, y_m: y }, label });

  const level = (id: string, buildingId: string, name: string, ordinal: number, elevationM: number): Level =>
    ({ id, org_id: ORG, building_id: buildingId, name, ordinal, elevation_m: elevationM });

  /** Les arêtes, longueurs calculées sur les nœuds et les niveaux donnés. */
  function edges(
    nodes: readonly Node[], levels: readonly Level[],
    specs: readonly (readonly [string, string, string, number, EdgeOptions?])[],
  ): Edge[] {
    const at = new Map(nodes.map(n => [n.id, n]));
    const elevation = new Map(levels.map(l => [l.id, l.elevation_m]));
    return specs.map(([id, from, to, widthM, over = {}]) => {
      const a = at.get(from);
      const b = at.get(to);
      if (a === undefined || b === undefined) throw new Error(`arête ${id} : nœud absent`);
      return {
        id, org_id: ORG, from_node_id: from, to_node_id: to, width_m: widthM,
        slope_pct: over.slope_pct ?? 0, accessible: over.accessible ?? true,
        direction: over.direction ?? 'both', evacuation_route: over.evacuation_route ?? false,
        length_m: edgeLengthBetween(
          { position: a.position, elevation_m: elevation.get(a.level_id) ?? 0 },
          { position: b.position, elevation_m: elevation.get(b.level_id) ?? 0 },
        ),
      };
    });
  }

  const link = (id: string, edgeId: string, kind: VerticalLinkKind, capacity: number, accessible: boolean):
  SiteData['graph']['vertical_links'][number] => ({ id, org_id: ORG, edge_id: edgeId, kind, capacity, accessible });

  const buildingLink = (id: string, edgeId: string, from: string, to: string, sheltered: boolean):
  SiteData['graph']['building_links'][number] =>
    ({ id, org_id: ORG, edge_id: edgeId, from_building_id: from, to_building_id: to, sheltered });

  const source = (id: string, levelId: string, time: string): SiteData['plan_sources'][number] => ({
    id, org_id: ORG, level_id: levelId, storage_path: `plans/${siteId}/${levelId}.png`,
    media_type: 'image/png', content_kind: 'raster', uploaded_at: `${day}T${time}:00.000Z`,
  });

  const calibration = (id: string, sourceId: string, time: string): SiteData['plan_calibrations'][number] => ({
    id, org_id: ORG, plan_source_id: sourceId, scale_m_per_px: 0.05, reference_distance_m: 20,
    rotation_deg: 0, calibrated_at: `${day}T${time}:00.000Z`,
  });

  const footprint = (
    id: string, levelId: string, kind: SiteData['footprints'][number]['kind'],
    unitCode: string | undefined, x: number, y: number, w: number, h: number,
  ): SiteData['footprints'][number] => ({
    id, org_id: ORG, level_id: levelId, kind,
    geometry: { vertices: [{ x_m: x, y_m: y }, { x_m: x + w, y_m: y }, { x_m: x + w, y_m: y + h }, { x_m: x, y_m: y + h }] },
    ...(unitCode === undefined ? {} : { unit_code: unitCode }),
  });

  const volume = (id: string, footprintId: string, baseM: number, heightM: number): SiteData['volumes'][number] =>
    ({ id, org_id: ORG, footprint_id: footprintId, base_elevation_m: baseM, height_m: heightM, material_key: 'concrete' });

  const destination = (
    id: string, footprintId: string, nodeId: string, categoryId: string, occupant: string, priority: number,
  ): SiteData['destinations'][number] => ({
    id, org_id: ORG, footprint_id: footprintId, node_id: nodeId, category_id: categoryId,
    occupant_name: occupant, occupancy_status: 'occupied', display_priority: priority, valid_from: '2026-01-01',
  });

  const names = (destinationId: string, fr: string, en: string): SiteData['destination_names'] => [
    { id: `dn-${destinationId}-fr`, org_id: ORG, destination_id: destinationId, lang: 'fr', value: fr },
    { id: `dn-${destinationId}-en`, org_id: ORG, destination_id: destinationId, lang: 'en', value: en },
  ];

  const profile = (
    id: string, key: string, name: string, excluded: readonly string[], requireAccessible: boolean,
  ): SiteData['travel_profiles'][number] => ({
    id, org_id: ORG, site_id: siteId, key, name, excluded_edge_kinds: excluded,
    require_accessible: requireAccessible, honor_hours: false,
  });

  return { node, level, edges, link, buildingLink, source, calibration, footprint, volume, destination, names, profile };
}

/** Ce qu'aucun des trois sites ne porte : la production des supports. */
export const NO_SIGNAGE = {
  support_types: [], supports: [], support_faces: [], content_blocks: [],
  support_versions: [], face_templates: [], parking_spaces: [],
} as const satisfies Partial<SiteData>;
