import type { SiteData } from '@azimut/core-model';

const LONG_NAME_FR = 'Service de consultation spécialisée en oto-rhino-laryngologie et chirurgie cervico-faciale';
const LONG_NAME_EN = 'Specialized consultation department for otorhinolaryngology and cervico-facial surgery';

export const refAdversarial: SiteData = {
  organization: {
    id: 'org-test-001',
    name: 'Test Organisation',
    slug: 'test-org',
  },
  site: {
    id: 'site-adversarial-001',
    org_id: 'org-test-001',
    name: 'Site adversarial',
    country_code: 'FR',
    rules_pack_id: null,
    // S1 — repère site posé au premier calage : les deux nombres sont ceux de
    // `cal-*`, recopiés, et plus jamais modifiés.
    origin_x: 0,
    origin_y: 0,
    // N1.2 — les quatre sites de référence sont bilingues : la déclaration
    // dit ce qu'ils portent, elle ne le décide pas.
    active_langs: ['fr', 'en'],
    // D1.1 — altitude du niveau de référence. Valeur de synthèse.
    reference_elevation_m: 42.5,
  },
  buildings: [
    {
      id: 'bldg-adv-001',
      org_id: 'org-test-001',
      site_id: 'site-adversarial-001',
      name: 'Bâtiment',
      independent_access: true,
      // N1.2 — deux plages dans la même journée : fermeture de midi.
      opening_hours: {
        monday: [{ from: '09:30', to: '12:30' }, { from: '14:00', to: '19:30' }],
        tuesday: [{ from: '09:30', to: '12:30' }, { from: '14:00', to: '19:30' }],
        wednesday: [{ from: '09:30', to: '12:30' }, { from: '14:00', to: '19:30' }],
        thursday: [{ from: '09:30', to: '12:30' }, { from: '14:00', to: '19:30' }],
        friday: [{ from: '09:30', to: '12:30' }, { from: '14:00', to: '19:30' }],
      },
      default_edge_width_m: 1.2,
    },
  ],
  levels: [
    {
      id: 'lvl-adv-001',
      org_id: 'org-test-001',
      building_id: 'bldg-adv-001',
      name: 'RDC',
      ordinal: 0,
      elevation_m: 0,
    },
  ],
  /** A5.2 / N1.4 — le niveau est calé : ce site éprouve le texte, pas le calage. */
  plan_sources: [
    {
      id: 'ps-adv-001',
      org_id: 'org-test-001',
      level_id: 'lvl-adv-001',
      storage_path: 'plans/site-adversarial-001/lvl-adv-001.png',
      media_type: 'image/png',
      uploaded_at: '2026-01-05T09:00:00.000Z',
    },
  ],
  plan_calibrations: [
    {
      id: 'cal-adv-001',
      org_id: 'org-test-001',
      plan_source_id: 'ps-adv-001',
      scale_m_per_px: 0.05,
      origin_x: 0,
      origin_y: 0,
      rotation_deg: 0,
      calibrated_at: '2026-01-05T10:20:00.000Z',
    },
  ],
  footprints: [
    {
      id: 'fp-adv-triangle',
      org_id: 'org-test-001',
      level_id: 'lvl-adv-001',
      geometry: {
        vertices: [
          { x_m: 0, y_m: 0 },
          { x_m: 0.001, y_m: 0 },
          { x_m: 0, y_m: 0.001 },
        ],
      },
      kind: 'cell',
      unit_code: 'C-A01',
    },
    {
      id: 'fp-adv-colinear',
      org_id: 'org-test-001',
      level_id: 'lvl-adv-001',
      geometry: {
        vertices: [
          { x_m: 10, y_m: 0 },
          { x_m: 20, y_m: 0 },
          { x_m: 30, y_m: 0 },
          { x_m: 20, y_m: 10 },
        ],
      },
      kind: 'circulation',
    },
  ],
  volumes: [],
  graph: {
    nodes: [
      {
        id: 'n-adv-a',
        org_id: 'org-test-001',
        level_id: 'lvl-adv-001',
        kind: 'entrance',
        position: { x_m: 0, y_m: 0 },
        label: 'A',
      },
      {
        id: 'n-adv-b',
        org_id: 'org-test-001',
        level_id: 'lvl-adv-001',
        kind: 'junction',
        position: { x_m: 10, y_m: 0 },
        label: 'B',
      },
      {
        id: 'n-adv-c',
        org_id: 'org-test-001',
        level_id: 'lvl-adv-001',
        kind: 'destination_access',
        position: { x_m: 20, y_m: 0 },
        label: 'C',
      },
      {
        id: 'n-adv-d',
        org_id: 'org-test-001',
        level_id: 'lvl-adv-001',
        kind: 'destination_access',
        position: { x_m: 10, y_m: 10 },
        label: 'D',
      },
    ],
    edges: [
      {
        id: 'e-adv-ab',
        org_id: 'org-test-001',
        from_node_id: 'n-adv-a',
        to_node_id: 'n-adv-b',
        width_m: 1.5,
        slope_pct: 0,
        accessible: true,
        direction: 'both',
        evacuation_route: true,
        length_m: 10,
      },
      {
        id: 'e-adv-bc',
        org_id: 'org-test-001',
        from_node_id: 'n-adv-b',
        to_node_id: 'n-adv-c',
        width_m: 1.5,
        slope_pct: 0,
        accessible: true,
        direction: 'both',
        evacuation_route: false,
        length_m: 10,
      },
      {
        id: 'e-adv-bd',
        org_id: 'org-test-001',
        from_node_id: 'n-adv-b',
        to_node_id: 'n-adv-d',
        width_m: 1.5,
        slope_pct: 0,
        accessible: true,
        direction: 'both',
        evacuation_route: false,
        length_m: 10,
      },
      {
        id: 'e-adv-ac-equal',
        org_id: 'org-test-001',
        from_node_id: 'n-adv-a',
        to_node_id: 'n-adv-c',
        width_m: 1.5,
        slope_pct: 0,
        accessible: true,
        direction: 'both',
        evacuation_route: false,
        length_m: 20,
      },
    ],
    vertical_links: [],
  },
  categories: [
    {
      id: 'cat-medical',
      org_id: 'org-test-001',
      sector_key: 'tertiary',
      code: 'medical',
      parent_id: null,
    },
  ],
  pictograms: [
    {
      id: 'picto-medical-wayfinding',
      org_id: 'org-test-001',
      category_id: 'cat-medical',
      source: 'internal',
      standard_ref: 'WF-002',
      svg_path: 'M10 10h20v20H10z',
      registry: 'wayfinding',
    },
  ],
  destinations: [
    {
      id: 'dest-adv-long',
      org_id: 'org-test-001',
      footprint_id: 'fp-adv-triangle',
      node_id: 'n-adv-c',
      category_id: 'cat-medical',
      occupant_name: LONG_NAME_FR,
      occupancy_status: 'occupied',
      display_priority: 1,
      // N1.2 / S5 — période close et période ouverte se déclarent pareil.
      valid_from: '2025-09-01',
      valid_to: '2027-08-31',
    },
  ],
  destination_names: [
    { id: 'dn-adv-fr', org_id: 'org-test-001', destination_id: 'dest-adv-long', lang: 'fr', value: LONG_NAME_FR },
    { id: 'dn-adv-en', org_id: 'org-test-001', destination_id: 'dest-adv-long', lang: 'en', value: LONG_NAME_EN },
  ],
  travel_profiles: [
    {
      id: 'tp-adv-standard',
      org_id: 'org-test-001',
      site_id: 'site-adversarial-001',
      key: 'standard',
      name: 'Visiteur standard',
      excluded_edge_kinds: [],
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
  supports: [],
  support_faces: [],
  content_blocks: [],
  support_versions: [],
  face_templates: [],
};
