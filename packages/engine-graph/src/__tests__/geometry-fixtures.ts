/**
 * Jeux d'essai de la validation géométrique, partagés par les deux fichiers
 * d'essai que A2.4 a séparés. Une seule construction de `SiteData` : deux qui
 * divergeraient feraient passer les mêmes contrôles sur deux sites différents.
 */
import type { SiteData, Footprint, Volume } from '@azimut/core-model';

/** Build a minimal SiteData with the given footprints and volumes. */
export function siteWith(
  footprints: readonly Footprint[],
  volumes: readonly Volume[] = [],
): SiteData {
  return {
    organization: { id: 'org1', name: 'T', slug: 't' },
    site: {
      id: 's1', org_id: 'org1', name: 'S', country_code: 'FR',
      rules_pack_id: null, active_langs: ['fr'],
    },
    buildings: [{ id: 'b1', org_id: 'org1', site_id: 's1', name: 'B', independent_access: true }],
    levels: [{ id: 'l1', org_id: 'org1', building_id: 'b1', name: 'RDC', ordinal: 0, elevation_m: 0 }],
    plan_sources: [],
    plan_calibrations: [],
    footprints,
    volumes,
    graph: { nodes: [], edges: [], vertical_links: [] },
    categories: [],
    pictograms: [],
    destinations: [],
    destination_names: [],
    travel_profiles: [],
    support_types: [],
    supports: [],
    support_faces: [],
    content_blocks: [],
    support_versions: [],
    face_templates: [],
    parkings: [],
    parking_spaces: [],
    parking_uncovered: [],
    vehicle_gates: [],
  };
}

export function fp(id: string, verts: [number, number][], level = 'l1'): Footprint {
  return {
    id, org_id: 'org1', level_id: level,
    geometry: { vertices: verts.map(([x, y]) => ({ x_m: x, y_m: y })) },
    kind: 'cell',
  };
}
export const GOOD_FP = fp('fp-good', [[0, 0], [10, 0], [10, 10], [0, 10]]);
