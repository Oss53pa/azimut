import type { SiteData } from '@azimut/core-model';
import { REF_RETAIL_GRAPH } from './ref-retail-graph.js';

/**
 * C1 — site de référence `ref-retail`.
 *
 * « Commerce multibâtiment, 5 niveaux. Ce qu'il éprouve : accès indépendants,
 * lobby commun, horaires distincts par bâtiment, une liaison inter-bâtiments
 * couverte et une non couverte. »
 *
 * C'est le seul site de référence qui porte des liaisons entre bâtiments, et
 * c'est là que M01.S10 se vérifie sur donnée de référence plutôt que sur un
 * site construit pour le cas. Le contre-exemple est `ref-broken`, qui porte
 * l'arête entre bâtiments à laquelle la ligne manque : C1 veut, pour chaque
 * cas de détection, un site qui le déclenche et un site voisin qui ne le
 * déclenche pas.
 *
 * Ce site est valide : `validateGraph` n'y lève aucune anomalie bloquante.
 * Un site de référence qui ne l'est pas ne sert plus de point de comparaison.
 *
 * Données construites. Aucun plan, aucune enseigne, aucune donnée client
 * réelle (A13.1).
 */
export const refRetail: SiteData = {
  organization: {
    id: 'org-test-001',
    name: 'Test Organisation',
    slug: 'test-org',
  },
  site: {
    id: 'site-retail-001',
    org_id: 'org-test-001',
    name: 'Centre commercial de référence',
    country_code: 'FR',
    timezone: 'Europe/Paris',
    // M01.S1 — repère posé au premier calage, celui du RDC de la galerie.
    origin_x_m: -6,
    origin_y_m: -4,
    active_langs: ['fr', 'en'],
    // D1.1 — altitude du niveau de référence, celui de la galerie.
    reference_elevation_m: 112,
  },
  // A5.8 — rattaché en socle au paquet d'essai du dépôt, `testkit/fixtures/
  // rules-packs/test-fixture`. Le pictogramme de sécurité du site vient de ce
  // paquet (A5.4) : sans rattachement, aucun site ne le verrait, et le site de
  // référence ne porterait pas le cas qu'il éprouve.
  rules_bindings: [
    { id: 'rb-rt-base', rules_pack_id: 'rp-test-0001', role: 'base' },
  ],
  /**
   * Deux bâtiments, deux accès propres, deux horaires : c'est ce que ce site
   * éprouve et qu'aucun autre ne porte. La galerie ouvre tard le samedi, et
   * l'annexe — bureaux et services — ferme le samedi.
   *
   * `default_edge_width_m` diffère aussi, et ce n'est pas un détail de
   * remplissage : M4 (partie M) fait hériter la largeur d'une arête du
   * bâtiment, et un site où les deux bâtiments déclarent la même largeur ne
   * prouverait pas que l'héritage lit le bon.
   */
  buildings: [
    {
      id: 'bldg-rt-galerie',
      org_id: 'org-test-001',
      site_id: 'site-retail-001',
      name: 'Galerie',
      independent_access: true,
      opening_hours: {
        monday: [{ from: '10:00', to: '20:00' }],
        tuesday: [{ from: '10:00', to: '20:00' }],
        wednesday: [{ from: '10:00', to: '20:00' }],
        thursday: [{ from: '10:00', to: '20:00' }],
        friday: [{ from: '10:00', to: '21:00' }],
        saturday: [{ from: '09:30', to: '21:00' }],
      },
      default_edge_width_m: 2.4,
    },
    {
      id: 'bldg-rt-annexe',
      org_id: 'org-test-001',
      site_id: 'site-retail-001',
      name: 'Annexe',
      independent_access: true,
      // Coupure de midi : N1.2 admet plusieurs plages par jour, et aucun autre
      // site de référence n'en porte.
      opening_hours: {
        monday: [{ from: '08:00', to: '12:30' }, { from: '13:30', to: '18:00' }],
        tuesday: [{ from: '08:00', to: '12:30' }, { from: '13:30', to: '18:00' }],
        wednesday: [{ from: '08:00', to: '12:30' }, { from: '13:30', to: '18:00' }],
        thursday: [{ from: '08:00', to: '12:30' }, { from: '13:30', to: '18:00' }],
        friday: [{ from: '08:00', to: '12:30' }, { from: '13:30', to: '17:00' }],
      },
      default_edge_width_m: 1.1,
    },
  ],
  /**
   * Cinq niveaux, trois d'un côté et deux de l'autre.
   *
   * Les altitudes ne sont pas alignées d'un bâtiment à l'autre, et c'est ce
   * qui rend les deux passages entre bâtiments praticables en rampe : l'annexe
   * est posée soixante centimètres plus haut que la galerie.
   */
  levels: [
    lvl('lvl-rt-g-rdc', 'bldg-rt-galerie', 'RDC', 0, 0),
    lvl('lvl-rt-g-r1', 'bldg-rt-galerie', 'R+1', 1, 4.5),
    lvl('lvl-rt-g-r2', 'bldg-rt-galerie', 'R+2', 2, 9),
    lvl('lvl-rt-a-rdc', 'bldg-rt-annexe', 'Annexe RDC', 0, 0.6),
    lvl('lvl-rt-a-r1', 'bldg-rt-annexe', 'Annexe R+1', 1, 4.2),
  ],
  /** A5.2 / N1.4 — les cinq niveaux sont relevés et calés. */
  plan_sources: [
    source('ps-rt-g-rdc', 'lvl-rt-g-rdc', '09:00'),
    source('ps-rt-g-r1', 'lvl-rt-g-r1', '09:05'),
    source('ps-rt-g-r2', 'lvl-rt-g-r2', '09:10'),
    source('ps-rt-a-rdc', 'lvl-rt-a-rdc', '09:15'),
    source('ps-rt-a-r1', 'lvl-rt-a-r1', '09:20'),
  ],
  plan_calibrations: [
    // Le plus ancien : c'est lui qui fixe le repère du site.
    calibration('cal-rt-g-rdc', 'ps-rt-g-rdc', '10:00'),
    calibration('cal-rt-g-r1', 'ps-rt-g-r1', '10:20'),
    calibration('cal-rt-g-r2', 'ps-rt-g-r2', '10:40'),
    calibration('cal-rt-a-rdc', 'ps-rt-a-rdc', '11:00'),
    calibration('cal-rt-a-r1', 'ps-rt-a-r1', '11:20'),
  ],
  /** Une cellule par niveau, chacune sous le nœud d'accès de sa boutique. */
  footprints: [
    cell('fp-rt-g-rdc', 'lvl-rt-g-rdc', 'G-001', 10),
    cell('fp-rt-g-r1', 'lvl-rt-g-r1', 'G-101', 10),
    cell('fp-rt-g-r2', 'lvl-rt-g-r2', 'G-201', 10),
    cell('fp-rt-a-rdc', 'lvl-rt-a-rdc', 'A-001', 80),
    cell('fp-rt-a-r1', 'lvl-rt-a-r1', 'A-101', 80),
  ],
  volumes: [
    volume('vol-rt-g-rdc', 'fp-rt-g-rdc', 0, 4.5),
    volume('vol-rt-g-r1', 'fp-rt-g-r1', 4.5, 4.5),
    volume('vol-rt-g-r2', 'fp-rt-g-r2', 9, 4.5),
    volume('vol-rt-a-rdc', 'fp-rt-a-rdc', 0.6, 3.6),
    volume('vol-rt-a-r1', 'fp-rt-a-r1', 4.2, 3.6),
  ],
  graph: REF_RETAIL_GRAPH,
  categories: [
    {
      id: 'cat-rt-retail',
      org_id: 'org-test-001',
      sector_key: 'retail',
      code: 'shop',
      parent_id: null,
    },
  ],
  pictograms: [
    {
      id: 'picto-rt-fire-exit',
      org_id: 'org-test-001',
      category_id: 'cat-rt-retail',
      source: 'internal',
      standard_ref: 'SF-001',
      svg_path: 'M5 5l10 10M15 5L5 15',
      registry: 'safety',
      function_key: null,
      // A5.4 : un pictogramme de sécurité vient d'un paquet de règles, contrainte
      // en base (migration 0055). Rattaché au paquet d'essai du dépôt.
      rules_pack_id: 'rp-test-0001',
    },
    {
      id: 'picto-rt-shop',
      org_id: 'org-test-001',
      category_id: 'cat-rt-retail',
      source: 'internal',
      standard_ref: 'WF-002',
      svg_path: 'M10 10h20v20H10z',
      registry: 'wayfinding',
      function_key: null,
      rules_pack_id: null,
    },
  ],
  destinations: [
    shop('dest-rt-g-rdc', 'fp-rt-g-rdc', 'n-rt-g-dest-rdc', 'Boutique G-001', 1),
    shop('dest-rt-g-r1', 'fp-rt-g-r1', 'n-rt-g-dest-r1', 'Boutique G-101', 2),
    shop('dest-rt-g-r2', 'fp-rt-g-r2', 'n-rt-g-dest-r2', 'Boutique G-201', 3),
    shop('dest-rt-a-rdc', 'fp-rt-a-rdc', 'n-rt-a-dest-rdc', 'Boutique A-001', 4),
    shop('dest-rt-a-r1', 'fp-rt-a-r1', 'n-rt-a-dest-r1', 'Boutique A-101', 5),
  ],
  destination_names: [
    ...names('dest-rt-g-rdc', 'Boutique G-001', 'Shop G-001'),
    ...names('dest-rt-g-r1', 'Boutique G-101', 'Shop G-101'),
    ...names('dest-rt-g-r2', 'Boutique G-201', 'Shop G-201'),
    ...names('dest-rt-a-rdc', 'Boutique A-001', 'Shop A-001'),
    ...names('dest-rt-a-r1', 'Boutique A-101', 'Shop A-101'),
  ],
  travel_profiles: [
    {
      id: 'tp-rt-standard',
      org_id: 'org-test-001',
      site_id: 'site-retail-001',
      key: 'standard',
      name: 'Visiteur standard',
      excluded_edge_kinds: [],
      require_accessible: false,
      honor_hours: false,
    },
    {
      id: 'tp-rt-accessible',
      org_id: 'org-test-001',
      site_id: 'site-retail-001',
      key: 'accessible',
      name: 'Visiteur PMR',
      excluded_edge_kinds: [],
      require_accessible: true,
      honor_hours: false,
    },
  ],
  // La signalétique de ce site n'est pas relevée : il éprouve la structure,
  // pas la composition. Un support vide n'est pas la même chose qu'un support
  // absent, et ce site n'en porte aucun.
  support_types: [],
  supports: [],
  support_faces: [],
  content_blocks: [],
  support_versions: [],
  face_templates: [],
  parking_spaces: [],
};

function lvl(
  id: string, buildingId: string, name: string, ordinal: number, elevationM: number,
): SiteData['levels'][number] {
  return {
    id,
    org_id: 'org-test-001',
    building_id: buildingId,
    name,
    ordinal,
    elevation_m: elevationM,
  };
}

function source(
  id: string, levelId: string, time: string,
): SiteData['plan_sources'][number] {
  return {
    id,
    org_id: 'org-test-001',
    level_id: levelId,
    storage_path: `plans/site-retail-001/${levelId}.png`,
    media_type: 'image/png',
    uploaded_at: `2026-02-10T${time}:00.000Z`,
  };
}

function calibration(
  id: string, sourceId: string, time: string,
): SiteData['plan_calibrations'][number] {
  return {
    id,
    org_id: 'org-test-001',
    plan_source_id: sourceId,
    scale_m_per_px: 0.04,
    reference_distance_m: 20,
    rotation_deg: 0,
    calibrated_at: `2026-02-10T${time}:00.000Z`,
  };
}

/** Une cellule de 20 m sur 10, posée autour du nœud d'accès de sa boutique. */
function cell(
  id: string, levelId: string, unitCode: string, x: number,
): SiteData['footprints'][number] {
  return {
    id,
    org_id: 'org-test-001',
    level_id: levelId,
    geometry: {
      vertices: [
        { x_m: x, y_m: 15 },
        { x_m: x + 20, y_m: 15 },
        { x_m: x + 20, y_m: 25 },
        { x_m: x, y_m: 25 },
      ],
    },
    kind: 'cell',
    unit_code: unitCode,
  };
}

function volume(
  id: string, footprintId: string, baseM: number, heightM: number,
): SiteData['volumes'][number] {
  return {
    id,
    org_id: 'org-test-001',
    footprint_id: footprintId,
    base_elevation_m: baseM,
    height_m: heightM,
    material_key: 'concrete',
  };
}

function shop(
  id: string, footprintId: string, nodeId: string, occupant: string, priority: number,
): SiteData['destinations'][number] {
  return {
    id,
    org_id: 'org-test-001',
    footprint_id: footprintId,
    node_id: nodeId,
    category_id: 'cat-rt-retail',
    occupant_name: occupant,
    occupancy_status: 'occupied',
    display_priority: priority,
    // N1.2 / M01.S5 — occupant en cours : la sortie n'est pas connue.
    valid_from: '2026-01-01',
  };
}

/**
 * N1.2 — le site déclare `fr` et `en`, et chaque destination porte les deux.
 * Une dénomination manquante lèverait `GRAPH.DESTINATION_NAME_MISSING`.
 */
function names(
  destinationId: string, fr: string, en: string,
): SiteData['destination_names'] {
  return [
    { id: `dn-${destinationId}-fr`, org_id: 'org-test-001', destination_id: destinationId, lang: 'fr', value: fr },
    { id: `dn-${destinationId}-en`, org_id: 'org-test-001', destination_id: destinationId, lang: 'en', value: en },
  ];
}
