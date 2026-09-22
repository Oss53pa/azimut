import type { SiteData } from '@azimut/core-model';

export const refBroken: SiteData = {
  organization: {
    id: 'org-test-001',
    name: 'Test Organisation',
    slug: 'test-org',
  },
  site: {
    id: 'site-broken-001',
    org_id: 'org-test-001',
    name: 'Site cassé',
    country_code: 'FR',
    rules_pack_id: null,
    // M01.S1 — aucun calage n'a eu lieu sur ce site : le repère n'est pas posé, et
    // `origin_x_m` / `origin_y_m` sont absents. Ce n'est pas l'origine (0, 0).
    // N1.2 — site bilingue. L'altitude du niveau de référence n'est pas
    // relevée : les altitudes de niveau restent justes, elles sont relatives.
    active_langs: ['fr', 'en'],
  },
  buildings: [
    {
      id: 'bldg-brk-001',
      org_id: 'org-test-001',
      site_id: 'site-broken-001',
      name: 'Bâtiment A',
      independent_access: true,
    },
  ],
  levels: [
    {
      id: 'lvl-brk-rdc',
      org_id: 'org-test-001',
      building_id: 'bldg-brk-001',
      name: 'RDC',
      ordinal: 0,
      elevation_m: 0,
    },
    {
      id: 'lvl-brk-r1',
      org_id: 'org-test-001',
      building_id: 'bldg-brk-001',
      name: 'R+1',
      ordinal: 1,
      elevation_m: 3,
    },
  ],
  /**
   * N1.4 — les deux situations que `CALIB.LEVEL_NOT_CALIBRATED` recouvre :
   *  - `lvl-brk-rdc` porte un fond de plan que personne n'a calé
   *    (`plan_source_count` vaut 1, la conduite à tenir est de caler) ;
   *  - `lvl-brk-r1` n'a aucun fond importé
   *    (`plan_source_count` vaut 0, la conduite à tenir est d'importer).
   */
  plan_sources: [
    {
      id: 'ps-brk-rdc',
      org_id: 'org-test-001',
      level_id: 'lvl-brk-rdc',
      storage_path: 'plans/site-broken-001/lvl-brk-rdc.png',
      media_type: 'image/png',
      uploaded_at: '2026-01-05T09:00:00.000Z',
    },
  ],
  plan_calibrations: [],
  /**
   * N1.4 — trois empreintes, chacune posée pour un cas :
   *  - `fp-brk-nocode` : cellule sans code, DATA.UNIT_CODE_REQUIRED ;
   *  - `fp-brk-dup-a` et `fp-brk-dup-b` : même code sur le même niveau,
   *    DATA.CODE_DUPLICATE ;
   *  - `fp-brk-other-level` : même code, mais sur l'autre niveau — il ne
   *    doit PAS être signalé, la portée de l'unicité étant le niveau.
   */
  footprints: [
    {
      id: 'fp-brk-nocode',
      org_id: 'org-test-001',
      level_id: 'lvl-brk-rdc',
      kind: 'cell',
      geometry: {
        vertices: [
          { x_m: 0, y_m: 0 },
          { x_m: 4, y_m: 0 },
          { x_m: 4, y_m: 3 },
          { x_m: 0, y_m: 3 },
        ],
      },
    },
    {
      id: 'fp-brk-dup-a',
      org_id: 'org-test-001',
      level_id: 'lvl-brk-rdc',
      kind: 'cell',
      unit_code: 'C-200',
      geometry: {
        vertices: [
          { x_m: 10, y_m: 0 },
          { x_m: 14, y_m: 0 },
          { x_m: 14, y_m: 3 },
          { x_m: 10, y_m: 3 },
        ],
      },
    },
    {
      id: 'fp-brk-dup-b',
      org_id: 'org-test-001',
      level_id: 'lvl-brk-rdc',
      kind: 'cell',
      // Même code, casse différente : un lecteur de panneau ne les distingue pas.
      unit_code: 'c-200',
      geometry: {
        vertices: [
          { x_m: 20, y_m: 0 },
          { x_m: 24, y_m: 0 },
          { x_m: 24, y_m: 3 },
          { x_m: 20, y_m: 3 },
        ],
      },
    },
    {
      id: 'fp-brk-other-level',
      org_id: 'org-test-001',
      level_id: 'lvl-brk-r1',
      kind: 'cell',
      unit_code: 'C-200',
      geometry: {
        vertices: [
          { x_m: 0, y_m: 10 },
          { x_m: 4, y_m: 10 },
          { x_m: 4, y_m: 13 },
          { x_m: 0, y_m: 13 },
        ],
      },
    },
  ],
  volumes: [],
  graph: {
    nodes: [
      {
        id: 'n-brk-entrance',
        org_id: 'org-test-001',
        level_id: 'lvl-brk-rdc',
        kind: 'entrance',
        position: { x_m: 0, y_m: 0 },
        label: 'Entrée',
      },
      {
        id: 'n-brk-orphan',
        org_id: 'org-test-001',
        level_id: 'lvl-brk-rdc',
        kind: 'junction',
        position: { x_m: 50, y_m: 50 },
        label: 'Nœud orphelin',
      },
      {
        id: 'n-brk-deadend',
        org_id: 'org-test-001',
        level_id: 'lvl-brk-rdc',
        kind: 'junction',
        position: { x_m: 10, y_m: 0 },
        label: 'Impasse',
      },
      {
        id: 'n-brk-island-a',
        org_id: 'org-test-001',
        level_id: 'lvl-brk-rdc',
        kind: 'destination_access',
        position: { x_m: 80, y_m: 80 },
        label: 'Île A',
      },
      {
        id: 'n-brk-island-b',
        org_id: 'org-test-001',
        level_id: 'lvl-brk-rdc',
        kind: 'destination_access',
        position: { x_m: 90, y_m: 80 },
        label: 'Île B',
      },
      {
        id: 'n-brk-r1-landing',
        org_id: 'org-test-001',
        level_id: 'lvl-brk-r1',
        kind: 'landing',
        position: { x_m: 0, y_m: 0 },
        label: 'Palier R+1',
      },
    ],
    edges: [
      {
        id: 'e-brk-01',
        org_id: 'org-test-001',
        from_node_id: 'n-brk-entrance',
        to_node_id: 'n-brk-deadend',
        width_m: 1.5,
        slope_pct: 0,
        accessible: true,
        direction: 'both',
        evacuation_route: false,
        length_m: 10,
      },
      {
        id: 'e-brk-zero-length',
        org_id: 'org-test-001',
        from_node_id: 'n-brk-entrance',
        to_node_id: 'n-brk-entrance',
        width_m: 1,
        slope_pct: 0,
        accessible: true,
        direction: 'both',
        evacuation_route: false,
        length_m: 0,
      },
      {
        id: 'e-brk-island',
        org_id: 'org-test-001',
        from_node_id: 'n-brk-island-a',
        to_node_id: 'n-brk-island-b',
        width_m: 1.5,
        slope_pct: 0,
        accessible: true,
        direction: 'both',
        evacuation_route: false,
        length_m: 10,
      },
      {
        id: 'e-brk-cross-level',
        org_id: 'org-test-001',
        from_node_id: 'n-brk-entrance',
        to_node_id: 'n-brk-r1-landing',
        width_m: 1.2,
        slope_pct: 0,
        accessible: false,
        direction: 'both',
        evacuation_route: false,
        length_m: 3,
      },
    ],
    vertical_links: [],
  },
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
      id: 'dest-brk-unreachable',
      org_id: 'org-test-001',
      footprint_id: '',
      node_id: 'n-brk-island-a',
      category_id: 'cat-office',
      occupant_name: 'Bureau inatteignable',
      occupancy_status: 'occupied',
      display_priority: 1,
    },
  ],
  destination_names: [
    { id: 'dn-brk-fr', org_id: 'org-test-001', destination_id: 'dest-brk-unreachable', lang: 'fr', value: 'Bureau inatteignable' },
    { id: 'dn-brk-en', org_id: 'org-test-001', destination_id: 'dest-brk-unreachable', lang: 'en', value: 'Unreachable office' },
  ],
  travel_profiles: [
    {
      id: 'tp-brk-standard',
      org_id: 'org-test-001',
      site_id: 'site-broken-001',
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
  parkings: [],
  parking_spaces: [],
  parking_uncovered: [],
  vehicle_gates: [],
};
