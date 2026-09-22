import type { SiteData } from '@azimut/core-model';
import { REF_MULTILEVEL_GRAPH } from './ref-multilevel-graph.js';

export const refMultilevel: SiteData = {
  organization: {
    id: 'org-test-001',
    name: 'Test Organisation',
    slug: 'test-org',
  },
  site: {
    id: 'site-multilevel-001',
    org_id: 'org-test-001',
    name: 'Site multi-niveaux',
    country_code: 'FR',
    timezone: 'Europe/Paris',
    rules_pack_id: null,
    // M01.S1 — repère site posé au premier calage, celui du RDC (`cal-ml-rdc`).
    // Non nul : l'origine a été posée sur un repère du site, pas sur le coin
    // de l'image du premier fond.
    origin_x_m: -12.5,
    origin_y_m: -8,
    // N1.2 — les quatre sites de référence sont bilingues : la déclaration
    // dit ce qu'ils portent, elle ne le décide pas.
    active_langs: ['fr', 'en'],
    // D1.1 — altitude du niveau de référence. Valeur de synthèse.
    reference_elevation_m: 42.5,
  },
  buildings: [
    {
      id: 'bldg-ml-001',
      org_id: 'org-test-001',
      site_id: 'site-multilevel-001',
      name: 'Bâtiment ML',
      independent_access: true,
      // N1.2 — un jour absent est fermé ; le dimanche n'est pas déclaré.
      opening_hours: {
        monday: [{ from: '08:00', to: '19:00' }],
        tuesday: [{ from: '08:00', to: '19:00' }],
        wednesday: [{ from: '08:00', to: '19:00' }],
        thursday: [{ from: '08:00', to: '19:00' }],
        friday: [{ from: '08:00', to: '19:00' }],
        saturday: [{ from: '09:00', to: '13:00' }],
      },
      default_edge_width_m: 1.4,
    },
  ],
  levels: [
    {
      id: 'lvl-ml-rdc',
      org_id: 'org-test-001',
      building_id: 'bldg-ml-001',
      name: 'RDC',
      ordinal: 0,
      elevation_m: 0,
    },
    {
      id: 'lvl-ml-r1',
      org_id: 'org-test-001',
      building_id: 'bldg-ml-001',
      name: 'R+1',
      ordinal: 1,
      elevation_m: 3,
    },
  ],
  /** A5.2 / N1.4 — les deux niveaux sont calés. */
  plan_sources: [
    {
      id: 'ps-ml-rdc',
      org_id: 'org-test-001',
      level_id: 'lvl-ml-rdc',
      storage_path: 'plans/site-multilevel-001/lvl-ml-rdc.png',
      media_type: 'image/png',
      uploaded_at: '2026-01-05T09:00:00.000Z',
    },
    {
      id: 'ps-ml-r1',
      org_id: 'org-test-001',
      level_id: 'lvl-ml-r1',
      storage_path: 'plans/site-multilevel-001/lvl-ml-r1.png',
      media_type: 'image/png',
      uploaded_at: '2026-01-05T09:05:00.000Z',
    },
  ],
  plan_calibrations: [
    {
      id: 'cal-ml-rdc',
      org_id: 'org-test-001',
      plan_source_id: 'ps-ml-rdc',
      scale_m_per_px: 0.05,
      // Premier calage du site : c'est cette origine que `site` porte.
      reference_distance_m: 10,
      rotation_deg: 0,
      // Le plus ancien des deux : c'est lui que `firstCalibration` désigne.
      calibrated_at: '2026-01-05T10:30:00.000Z',
    },
    {
      id: 'cal-ml-r1',
      org_id: 'org-test-001',
      plan_source_id: 'ps-ml-r1',
      scale_m_per_px: 0.05,
      // Autre fond, autre décalage : le repère site, lui, ne change pas.
      reference_distance_m: 10,
      rotation_deg: 0,
      // Calé plus tard : il ne fixe rien.
      calibrated_at: '2026-01-05T11:45:00.000Z',
    },
  ],
  footprints: [
    {
      id: 'fp-ml-rdc',
      org_id: 'org-test-001',
      level_id: 'lvl-ml-rdc',
      geometry: {
        vertices: [
          { x_m: 0, y_m: 0 },
          { x_m: 40, y_m: 0 },
          { x_m: 40, y_m: 20 },
          { x_m: 0, y_m: 20 },
        ],
      },
      kind: 'cell',
      unit_code: 'C-000',
    },
    {
      id: 'fp-ml-r1',
      org_id: 'org-test-001',
      level_id: 'lvl-ml-r1',
      geometry: {
        vertices: [
          { x_m: 0, y_m: 0 },
          { x_m: 40, y_m: 0 },
          { x_m: 40, y_m: 20 },
          { x_m: 0, y_m: 20 },
        ],
      },
      kind: 'cell',
      unit_code: 'C-100',
    },
  ],
  volumes: [
    {
      id: 'vol-ml-rdc',
      org_id: 'org-test-001',
      footprint_id: 'fp-ml-rdc',
      base_elevation_m: 0,
      height_m: 3,
      material_key: 'concrete',
    },
    {
      id: 'vol-ml-r1',
      org_id: 'org-test-001',
      footprint_id: 'fp-ml-r1',
      base_elevation_m: 3,
      height_m: 3,
      material_key: 'concrete',
    },
  ],
  graph: REF_MULTILEVEL_GRAPH,
  categories: [
    {
      id: 'cat-office',
      org_id: 'org-test-001',
      sector_key: 'tertiary',
      code: 'office',
      parent_id: null,
    },
  ],
  pictograms: [
    {
      id: 'picto-fire-exit-safety',
      org_id: 'org-test-001',
      category_id: 'cat-office',
      source: 'internal',
      standard_ref: 'SF-001',
      svg_path: 'M5 5l10 10M15 5L5 15',
      registry: 'safety',
    },
    {
      id: 'picto-office-wayfinding',
      org_id: 'org-test-001',
      category_id: 'cat-office',
      source: 'internal',
      standard_ref: 'WF-001',
      svg_path: 'M10 10h20v20H10z',
      registry: 'wayfinding',
    },
  ],
  destinations: [
    {
      id: 'dest-ml-rdc',
      org_id: 'org-test-001',
      footprint_id: 'fp-ml-rdc',
      node_id: 'n-ml-dest-rdc',
      category_id: 'cat-office',
      occupant_name: 'Bureau RDC',
      occupancy_status: 'occupied',
      display_priority: 1,
      // N1.2 / M01.S5 — occupant en cours : la sortie n'est pas connue.
      valid_from: '2026-01-01',
    },
    {
      id: 'dest-ml-r1',
      org_id: 'org-test-001',
      footprint_id: 'fp-ml-r1',
      node_id: 'n-ml-dest-r1',
      category_id: 'cat-office',
      occupant_name: 'Bureau R+1',
      occupancy_status: 'occupied',
      display_priority: 2,
      // N1.2 / M01.S5 — occupant en cours : la sortie n'est pas connue.
      valid_from: '2026-01-01',
    },
  ],
  destination_names: [
    { id: 'dn-ml-rdc-fr', org_id: 'org-test-001', destination_id: 'dest-ml-rdc', lang: 'fr', value: 'Bureau RDC' },
    { id: 'dn-ml-rdc-en', org_id: 'org-test-001', destination_id: 'dest-ml-rdc', lang: 'en', value: 'Ground floor office' },
    { id: 'dn-ml-r1-fr', org_id: 'org-test-001', destination_id: 'dest-ml-r1', lang: 'fr', value: 'Bureau R+1' },
    { id: 'dn-ml-r1-en', org_id: 'org-test-001', destination_id: 'dest-ml-r1', lang: 'en', value: 'First floor office' },
  ],
  travel_profiles: [
    {
      id: 'tp-ml-standard',
      org_id: 'org-test-001',
      site_id: 'site-multilevel-001',
      key: 'standard',
      name: 'Visiteur standard',
      excluded_edge_kinds: [],
      require_accessible: false,
      honor_hours: false,
    },
    {
      id: 'tp-ml-accessible',
      org_id: 'org-test-001',
      site_id: 'site-multilevel-001',
      key: 'accessible',
      name: 'Visiteur PMR',
      excluded_edge_kinds: [],
      require_accessible: true,
      honor_hours: false,
    },
    {
      id: 'tp-ml-evacuation',
      org_id: 'org-test-001',
      site_id: 'site-multilevel-001',
      key: 'evacuation',
      name: 'Évacuation',
      excluded_edge_kinds: ['elevator'],
      require_accessible: false,
      honor_hours: false,
    },
  ],
  support_types: [
    {
      id: 'stype-directional',
      org_id: 'org-test-001',
      key: 'directional',
      name: 'Panneau directionnel',
      face_count: 1,
      faces: [{ side: 'front', default_width_mm: 600, default_height_mm: 400 }],
    },
  ],
  supports: [
    {
      id: 'sup-001',
      org_id: 'org-test-001',
      site_id: 'site-multilevel-001',
      node_id: 'n-ml-hall',
      registry: 'wayfinding',
      context: 'interior',
      reading_distance_m: 5,
      azimuth_deg: 0,
    },
  ],
  support_faces: [],
  content_blocks: [],
  support_versions: [],
  face_templates: [
    {
      id: 'ftpl-dir-front',
      org_id: 'org-test-001',
      support_type_key: 'directional',
      side: 'front',
      name: 'Directionnel standard',
      blocks: [
        {
          kind: 'header',
          ordinal: 0,
          region: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 20 },
          config: {},
        },
        {
          kind: 'destination_list',
          ordinal: 1,
          region: { x_pct: 0, y_pct: 20, w_pct: 100, h_pct: 80 },
          config: {},
        },
      ],
    },
  ],
  // Complément atelier M2 — stationnement. Le seul site de référence qui en
  // porte, comme il est le seul à porter un vocabulaire : les autres montrent
  // le cas d'un site qui n'en déclare pas.
  //
  // Quatre places annoncées, quatre numérisées : cas conforme. Les cas fautifs
  // sont couverts en test unitaire, pas en donnée de référence, pour qu'un site
  // de référence reste un site valide.
  parkings: [
    {
      id: 'park-ml-ouest',
      org_id: 'org-test-001',
      level_id: 'lvl-ml-rdc',
      geometry: {
        vertices: [
          { x_m: 0, y_m: -30 },
          { x_m: 40, y_m: -30 },
          { x_m: 40, y_m: -5 },
          { x_m: 0, y_m: -5 },
        ],
      },
      name: 'Parking Ouest',
      free: true,
      declared_capacity: 4,
      provenance: { status: 'existant', source: 'Plan RDC indice 20' },
    },
  ],
  parking_spaces: [
    {
      id: 'space-ml-a1',
      org_id: 'org-test-001',
      parking_id: 'park-ml-ouest',
      kind: 'standard',
      row: 'A',
      provenance: { status: 'existant', source: 'Plan RDC indice 20' },
    },
    {
      id: 'space-ml-a2',
      org_id: 'org-test-001',
      parking_id: 'park-ml-ouest',
      kind: 'standard',
      row: 'A',
      provenance: { status: 'existant', source: 'Plan RDC indice 20' },
    },
    {
      id: 'space-ml-a3',
      org_id: 'org-test-001',
      parking_id: 'park-ml-ouest',
      kind: 'pmr',
      row: 'A',
      provenance: { status: 'existant', source: 'Plan RDC indice 20' },
    },
    {
      id: 'space-ml-b1',
      org_id: 'org-test-001',
      parking_id: 'park-ml-ouest',
      kind: 'livraison',
      row: 'B',
      provenance: { status: 'existant', source: 'Plan RDC indice 20' },
    },
  ],
  parking_uncovered: [],
  vehicle_gates: [
    {
      id: 'gate-ml-v1',
      org_id: 'org-test-001',
      level_id: 'lvl-ml-rdc',
      code: 'V1',
      role: 'Entrée véhicules',
      width_m: 6,
      position: { x_m: 0, y_m: -18 },
      provenance: { status: 'existant', source: 'Plan RDC indice 20' },
    },
  ],
};
