import type { SiteData } from '@azimut/core-model';
import { NO_SIGNAGE, ORG, siteKit } from './site-kit.js';

/**
 * C1 — site de référence `ref-campus`.
 *
 * « Campus. Ce qu'il éprouve : cheminements extérieurs, liaisons entre
 * bâtiments distants. »
 *
 * Trois bâtiments à près de deux cents mètres les uns des autres, posés à des
 * altitudes différentes sur un terrain en pente. Deux allées découvertes
 * partent du parvis des amphithéâtres, sur une empreinte extérieure ; une
 * galerie couverte relie les laboratoires à la bibliothèque. Chaque liaison
 * entre bâtiments porte sa ligne `building_link` (M01.S10) et, reliant deux
 * niveaux, sa liaison verticale (A5.3) : ce sont des rampes.
 *
 * Limite déclarée par M01 : aucun calcul de parcours ne lit encore l'attribut
 * de passage couvert (`sheltered`).
 *
 * Le site est valide : `validateGraph` n'y lève aucune anomalie bloquante.
 */
const SITE = 'site-campus-001';
const k = siteKit(SITE, '2026-03-04');

const A = 'bldg-cp-amphis';
const B = 'bldg-cp-labos';
const C = 'bldg-cp-biblio';
const A_RDC = 'lvl-cp-a-rdc';
const B_RDC = 'lvl-cp-b-rdc';
const B_R1 = 'lvl-cp-b-r1';
const C_RDC = 'lvl-cp-c-rdc';

const levels = [
  k.level(A_RDC, A, 'Amphithéâtres RDC', 0, 0),
  k.level(B_RDC, B, 'Laboratoires RDC', 0, 2),
  k.level(B_R1, B, 'Laboratoires R+1', 1, 6),
  k.level(C_RDC, C, 'Bibliothèque RDC', 0, 1),
];

const nodes = [
  // — Amphithéâtres, et le parvis d'où partent les allées —
  k.node('n-cp-a-entree', A_RDC, 'entrance', 0, -10, 'Entrée des amphithéâtres'),
  k.node('n-cp-a-hall', A_RDC, 'junction', 0, 0, 'Hall des amphithéâtres'),
  k.node('n-cp-a-amphi', A_RDC, 'destination_access', -10, 10, 'Grand amphithéâtre'),
  k.node('n-cp-a-parvis', A_RDC, 'junction', 20, 0, 'Parvis'),
  // — Laboratoires —
  k.node('n-cp-b-hall', B_RDC, 'junction', 240, 40, 'Hall des laboratoires'),
  k.node('n-cp-b-entree', B_RDC, 'entrance', 250, 30, 'Entrée des laboratoires'),
  k.node('n-cp-b-asc-rdc', B_RDC, 'elevator', 245, 50, 'Ascenseur RDC'),
  k.node('n-cp-b-esc-rdc', B_RDC, 'stair', 238, 44, 'Escalier RDC'),
  k.node('n-cp-b-asc-r1', B_R1, 'elevator', 245, 50, 'Ascenseur R+1'),
  k.node('n-cp-b-esc-r1', B_R1, 'stair', 238, 44, 'Escalier R+1'),
  k.node('n-cp-b-palier', B_R1, 'junction', 240, 60, 'Palier R+1'),
  k.node('n-cp-b-labo', B_R1, 'destination_access', 250, 65, 'Laboratoires'),
  // — Bibliothèque —
  k.node('n-cp-c-entree', C_RDC, 'entrance', 120, -190, 'Entrée de la bibliothèque'),
  k.node('n-cp-c-hall', C_RDC, 'junction', 120, -180, 'Hall de la bibliothèque'),
  k.node('n-cp-c-galerie', C_RDC, 'junction', 130, -170, 'Départ de la galerie couverte'),
  k.node('n-cp-c-biblio', C_RDC, 'destination_access', 130, -185, 'Salle de lecture'),
];

const edges = k.edges(nodes, levels, [
  ['e-cp-a-entree', 'n-cp-a-entree', 'n-cp-a-hall', 3],
  ['e-cp-a-amphi', 'n-cp-a-hall', 'n-cp-a-amphi', 3],
  ['e-cp-a-parvis', 'n-cp-a-hall', 'n-cp-a-parvis', 4],
  // Les cheminements extérieurs, découverts.
  ['e-cp-allee-ab', 'n-cp-a-parvis', 'n-cp-b-hall', 3, { slope_pct: 0.9 }],
  ['e-cp-allee-ac', 'n-cp-a-parvis', 'n-cp-c-hall', 3, { slope_pct: 0.5 }],
  // La galerie couverte, entre laboratoires et bibliothèque.
  ['e-cp-galerie-bc', 'n-cp-b-hall', 'n-cp-c-galerie', 2.5, { slope_pct: -0.4 }],
  ['e-cp-b-entree', 'n-cp-b-entree', 'n-cp-b-hall', 2.4],
  ['e-cp-b-hall-asc', 'n-cp-b-hall', 'n-cp-b-asc-rdc', 2.4],
  ['e-cp-b-hall-esc', 'n-cp-b-hall', 'n-cp-b-esc-rdc', 2.4],
  ['e-cp-b-asc', 'n-cp-b-asc-rdc', 'n-cp-b-asc-r1', 1.4],
  ['e-cp-b-esc', 'n-cp-b-esc-rdc', 'n-cp-b-esc-r1', 1.4, { accessible: false, evacuation_route: true }],
  ['e-cp-b-r1-asc', 'n-cp-b-asc-r1', 'n-cp-b-palier', 2.4],
  ['e-cp-b-r1-esc', 'n-cp-b-esc-r1', 'n-cp-b-palier', 2.4],
  ['e-cp-b-r1-labo', 'n-cp-b-palier', 'n-cp-b-labo', 2.4],
  ['e-cp-c-entree', 'n-cp-c-entree', 'n-cp-c-hall', 2.4],
  ['e-cp-c-galerie', 'n-cp-c-hall', 'n-cp-c-galerie', 2.4],
  ['e-cp-c-biblio', 'n-cp-c-hall', 'n-cp-c-biblio', 2.4],
]);

const WEEK = { from: '08:00', to: '20:00' };

export const refCampus: SiteData = {
  organization: { id: ORG, name: 'Test Organisation', slug: 'test-org' },
  site: {
    id: SITE, org_id: ORG, name: 'Campus de référence', country_code: 'FR', timezone: 'Europe/Paris',
    origin_x_m: -20, origin_y_m: -200, active_langs: ['fr', 'en'], reference_elevation_m: 160,
  },
  rules_bindings: [{ id: 'rb-cp-base', rules_pack_id: 'rp-test-0001', role: 'base' }],
  buildings: [
    { id: A, org_id: ORG, site_id: SITE, name: 'Amphithéâtres', independent_access: true, default_edge_width_m: 3 },
    { id: B, org_id: ORG, site_id: SITE, name: 'Laboratoires', independent_access: true, default_edge_width_m: 2.4 },
    {
      id: C, org_id: ORG, site_id: SITE, name: 'Bibliothèque', independent_access: true, default_edge_width_m: 2.4,
      opening_hours: {
        monday: [WEEK], tuesday: [WEEK], wednesday: [WEEK], thursday: [WEEK], friday: [WEEK],
        saturday: [{ from: '10:00', to: '18:00' }],
      },
    },
  ],
  levels,
  plan_sources: [
    k.source('ps-cp-a-rdc', A_RDC, '09:00'), k.source('ps-cp-b-rdc', B_RDC, '09:05'),
    k.source('ps-cp-b-r1', B_R1, '09:10'), k.source('ps-cp-c-rdc', C_RDC, '09:15'),
  ],
  plan_calibrations: [
    k.calibration('cal-cp-a-rdc', 'ps-cp-a-rdc', '10:00'), k.calibration('cal-cp-b-rdc', 'ps-cp-b-rdc', '10:20'),
    k.calibration('cal-cp-b-r1', 'ps-cp-b-r1', '10:40'), k.calibration('cal-cp-c-rdc', 'ps-cp-c-rdc', '11:00'),
  ],
  footprints: [
    k.footprint('fp-cp-amphi', A_RDC, 'cell', 'A-001', -30, 5, 25, 20),
    // Le parvis : une empreinte extérieure, d'où partent les deux allées.
    k.footprint('fp-cp-parvis', A_RDC, 'outdoor', undefined, 10, -15, 30, 25),
    k.footprint('fp-cp-labo', B_R1, 'cell', 'B-101', 245, 60, 20, 12),
    k.footprint('fp-cp-biblio', C_RDC, 'cell', 'C-001', 125, -195, 25, 15),
  ],
  volumes: [
    k.volume('vol-cp-amphi', 'fp-cp-amphi', 0, 8),
    k.volume('vol-cp-labo', 'fp-cp-labo', 6, 4),
    k.volume('vol-cp-biblio', 'fp-cp-biblio', 1, 5),
  ],
  graph: {
    nodes,
    edges,
    vertical_links: [
      k.link('vl-cp-allee-ab', 'e-cp-allee-ab', 'ramp', 200, true),
      k.link('vl-cp-allee-ac', 'e-cp-allee-ac', 'ramp', 200, true),
      k.link('vl-cp-galerie-bc', 'e-cp-galerie-bc', 'ramp', 120, true),
      k.link('vl-cp-b-asc', 'e-cp-b-asc', 'elevator', 8, true),
      k.link('vl-cp-b-esc', 'e-cp-b-esc', 'stair', 40, false),
    ],
    building_links: [
      k.buildingLink('bl-cp-allee-ab', 'e-cp-allee-ab', A, B, false),
      k.buildingLink('bl-cp-allee-ac', 'e-cp-allee-ac', A, C, false),
      k.buildingLink('bl-cp-galerie-bc', 'e-cp-galerie-bc', B, C, true),
    ],
  },
  categories: [{ id: 'cat-cp-teaching', org_id: ORG, sector_key: 'education', code: 'teaching', parent_id: null }],
  pictograms: [
    {
      id: 'picto-cp-fire-exit', org_id: ORG, category_id: 'cat-cp-teaching', source: 'internal', standard_ref: 'SF-001',
      svg_path: 'M5 5l10 10M15 5L5 15', registry: 'safety', function_key: null, rules_pack_id: 'rp-test-0001',
    },
  ],
  destinations: [
    k.destination('dest-cp-amphi', 'fp-cp-amphi', 'n-cp-a-amphi', 'cat-cp-teaching', 'Grand amphithéâtre', 1),
    k.destination('dest-cp-labo', 'fp-cp-labo', 'n-cp-b-labo', 'cat-cp-teaching', 'Laboratoires', 2),
    k.destination('dest-cp-biblio', 'fp-cp-biblio', 'n-cp-c-biblio', 'cat-cp-teaching', 'Bibliothèque', 3),
  ],
  destination_names: [
    ...k.names('dest-cp-amphi', 'Grand amphithéâtre', 'Main lecture hall'),
    ...k.names('dest-cp-labo', 'Laboratoires', 'Laboratories'),
    ...k.names('dest-cp-biblio', 'Bibliothèque', 'Library'),
  ],
  travel_profiles: [
    k.profile('tp-cp-standard', 'standard', 'Visiteur', [], false),
    k.profile('tp-cp-accessible', 'accessible', 'Visiteur PMR', [], true),
    k.profile('tp-cp-evacuation', 'evacuation', 'Évacuation', ['elevator'], false),
  ],
  ...NO_SIGNAGE,
};
