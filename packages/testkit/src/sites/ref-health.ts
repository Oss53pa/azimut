import type { SiteData } from '@azimut/core-model';
import { NO_SIGNAGE, ORG, siteKit } from './site-kit.js';

/**
 * C1 — site de référence `ref-health`.
 *
 * « Établissement de santé. Ce qu'il éprouve : flux séparés, service ouvert en
 * continu, profil brancard. »
 *
 * - **Flux séparés** : le public entre par le hall, les urgences par leur sas.
 *   Les deux circulations ne se rejoignent qu'au couloir de service, et le
 *   brancard monte par son propre ascenseur. Le modèle ne sait pas réserver une
 *   arête à un profil (A5.5 n'exclut que des natures de nœud) : la séparation
 *   est portée par la topologie, pas par une règle de parcours.
 * - **Profil brancard** : accessible, sans escalier ni escalator.
 * - **Service ouvert en continu** : *non représenté*. Une plage horaire
 *   s'écrit `HH:MM` à `HH:MM`, de 00:00 à 23:59, sans 24:00 ni franchissement
 *   de minuit (`opening-hours.ts`) ; un bâtiment sans horaires déclarés n'est
 *   pas un bâtiment ouvert sans interruption. L'hôpital ne déclare donc aucun
 *   horaire, et le cas attend une décision (A2.2, cas 2), consignée dans
 *   `docs/matrice-avancement-increments-0-2.md`.
 *
 * Le site est valide : `validateGraph` n'y lève aucune anomalie bloquante.
 */
const SITE = 'site-health-001';
const k = siteKit(SITE, '2026-03-02');

const H = 'bldg-hl-hopital';
const C = 'bldg-hl-consult';
const H_RDC = 'lvl-hl-h-rdc';
const H_R1 = 'lvl-hl-h-r1';
const C_RDC = 'lvl-hl-c-rdc';

const levels = [
  k.level(H_RDC, H, 'Hôpital RDC', 0, 0),
  k.level(H_R1, H, 'Hôpital R+1', 1, 4.2),
  k.level(C_RDC, C, 'Consultations RDC', 0, 0.3),
];

const nodes = [
  // — Hôpital, rez-de-chaussée : deux entrées, deux circulations —
  k.node('n-hl-entree-public', H_RDC, 'entrance', 0, 0, 'Entrée principale'),
  k.node('n-hl-hall', H_RDC, 'junction', 0, 10, 'Hall d’accueil'),
  k.node('n-hl-asc-public-rdc', H_RDC, 'elevator', 10, 10, 'Ascenseur public RDC'),
  k.node('n-hl-esc-rdc', H_RDC, 'stair', 20, 10, 'Escalier RDC'),
  k.node('n-hl-couloir', H_RDC, 'junction', 30, 10, 'Couloir de service'),
  k.node('n-hl-radio', H_RDC, 'destination_access', 30, 20, 'Imagerie'),
  k.node('n-hl-asc-brancard-rdc', H_RDC, 'elevator', 50, 10, 'Ascenseur brancard RDC'),
  k.node('n-hl-sas-urgences', H_RDC, 'junction', 60, 10, 'Sas des urgences'),
  k.node('n-hl-entree-urgences', H_RDC, 'entrance', 60, 0, 'Entrée des urgences'),
  k.node('n-hl-urgences', H_RDC, 'destination_access', 70, 20, 'Accueil des urgences'),
  k.node('n-hl-galerie', H_RDC, 'junction', 0, 30, 'Galerie vers les consultations'),
  // — Hôpital, premier étage —
  k.node('n-hl-asc-public-r1', H_R1, 'elevator', 10, 10, 'Ascenseur public R+1'),
  k.node('n-hl-esc-r1', H_R1, 'stair', 20, 10, 'Escalier R+1'),
  k.node('n-hl-palier-r1', H_R1, 'junction', 30, 10, 'Palier R+1'),
  k.node('n-hl-asc-brancard-r1', H_R1, 'elevator', 50, 10, 'Ascenseur brancard R+1'),
  k.node('n-hl-chambres', H_R1, 'destination_access', 30, 20, 'Hospitalisation'),
  // — Consultations —
  k.node('n-hl-c-hall', C_RDC, 'junction', 0, 50, 'Hall des consultations'),
  k.node('n-hl-c-entree', C_RDC, 'entrance', 0, 60, 'Entrée des consultations'),
  k.node('n-hl-c-consult', C_RDC, 'destination_access', 10, 55, 'Consultations externes'),
];

const edges = k.edges(nodes, levels, [
  ['e-hl-entree-hall', 'n-hl-entree-public', 'n-hl-hall', 3],
  ['e-hl-hall-asc', 'n-hl-hall', 'n-hl-asc-public-rdc', 2.4],
  ['e-hl-asc-esc', 'n-hl-asc-public-rdc', 'n-hl-esc-rdc', 2.4],
  ['e-hl-esc-couloir', 'n-hl-esc-rdc', 'n-hl-couloir', 2.4],
  ['e-hl-couloir-radio', 'n-hl-couloir', 'n-hl-radio', 2.4],
  ['e-hl-couloir-brancard', 'n-hl-couloir', 'n-hl-asc-brancard-rdc', 2.4],
  ['e-hl-brancard-sas', 'n-hl-asc-brancard-rdc', 'n-hl-sas-urgences', 2.4],
  ['e-hl-entree-urg-sas', 'n-hl-entree-urgences', 'n-hl-sas-urgences', 3],
  ['e-hl-sas-urgences', 'n-hl-sas-urgences', 'n-hl-urgences', 2.4],
  ['e-hl-hall-galerie', 'n-hl-hall', 'n-hl-galerie', 2.4],
  // Cages verticales.
  ['e-hl-asc-public', 'n-hl-asc-public-rdc', 'n-hl-asc-public-r1', 1.4],
  ['e-hl-asc-brancard', 'n-hl-asc-brancard-rdc', 'n-hl-asc-brancard-r1', 2.1],
  ['e-hl-esc', 'n-hl-esc-rdc', 'n-hl-esc-r1', 1.6, { accessible: false, evacuation_route: true }],
  // Premier étage.
  ['e-hl-r1-asc-palier', 'n-hl-asc-public-r1', 'n-hl-esc-r1', 2.4],
  ['e-hl-r1-esc-palier', 'n-hl-esc-r1', 'n-hl-palier-r1', 2.4],
  ['e-hl-r1-palier-brancard', 'n-hl-palier-r1', 'n-hl-asc-brancard-r1', 2.4],
  ['e-hl-r1-palier-chambres', 'n-hl-palier-r1', 'n-hl-chambres', 2.4],
  // La galerie couverte, seule arête entre les bâtiments : elle gagne les
  // trente centimètres du rez-de-chaussée des consultations.
  ['e-hl-galerie', 'n-hl-galerie', 'n-hl-c-hall', 2.4, { slope_pct: 1.5 }],
  ['e-hl-c-entree-hall', 'n-hl-c-entree', 'n-hl-c-hall', 2.4],
  ['e-hl-c-hall-consult', 'n-hl-c-hall', 'n-hl-c-consult', 2.4],
]);

export const refHealth: SiteData = {
  organization: { id: ORG, name: 'Test Organisation', slug: 'test-org' },
  site: {
    id: SITE, org_id: ORG, name: 'Centre hospitalier de référence', country_code: 'FR',
    timezone: 'Europe/Paris', origin_x_m: 0, origin_y_m: 0, active_langs: ['fr', 'en'], reference_elevation_m: 35,
  },
  rules_bindings: [{ id: 'rb-hl-base', rules_pack_id: 'rp-test-0001', role: 'base' }],
  buildings: [
    // Aucun horaire déclaré : voir l'en-tête, « service ouvert en continu ».
    { id: H, org_id: ORG, site_id: SITE, name: 'Hôpital', independent_access: true, default_edge_width_m: 2.4 },
    {
      id: C, org_id: ORG, site_id: SITE, name: 'Consultations', independent_access: true, default_edge_width_m: 2.4,
      opening_hours: {
        monday: [{ from: '08:00', to: '19:00' }], tuesday: [{ from: '08:00', to: '19:00' }],
        wednesday: [{ from: '08:00', to: '19:00' }], thursday: [{ from: '08:00', to: '19:00' }],
        friday: [{ from: '08:00', to: '19:00' }], saturday: [{ from: '08:00', to: '12:00' }],
      },
    },
  ],
  levels,
  plan_sources: [k.source('ps-hl-h-rdc', H_RDC, '09:00'), k.source('ps-hl-h-r1', H_R1, '09:05'), k.source('ps-hl-c-rdc', C_RDC, '09:10')],
  plan_calibrations: [
    k.calibration('cal-hl-h-rdc', 'ps-hl-h-rdc', '10:00'), k.calibration('cal-hl-h-r1', 'ps-hl-h-r1', '10:20'),
    k.calibration('cal-hl-c-rdc', 'ps-hl-c-rdc', '10:40'),
  ],
  footprints: [
    k.footprint('fp-hl-urgences', H_RDC, 'cell', 'H-URG', 62, 15, 16, 12),
    k.footprint('fp-hl-radio', H_RDC, 'cell', 'H-IMG', 24, 15, 12, 10),
    k.footprint('fp-hl-chambres', H_R1, 'cell', 'H-101', 22, 15, 20, 12),
    k.footprint('fp-hl-consult', C_RDC, 'cell', 'C-001', 4, 52, 14, 10),
  ],
  volumes: [
    k.volume('vol-hl-urgences', 'fp-hl-urgences', 0, 4.2), k.volume('vol-hl-radio', 'fp-hl-radio', 0, 4.2),
    k.volume('vol-hl-chambres', 'fp-hl-chambres', 4.2, 3.6), k.volume('vol-hl-consult', 'fp-hl-consult', 0.3, 3.3),
  ],
  graph: {
    nodes,
    edges,
    vertical_links: [
      k.link('vl-hl-asc-public', 'e-hl-asc-public', 'elevator', 8, true),
      // L'ascenseur brancard : peu de places, une cabine profonde.
      k.link('vl-hl-asc-brancard', 'e-hl-asc-brancard', 'elevator', 2, true),
      k.link('vl-hl-esc', 'e-hl-esc', 'stair', 60, false),
      k.link('vl-hl-galerie', 'e-hl-galerie', 'ramp', 40, true),
    ],
    building_links: [k.buildingLink('bl-hl-galerie', 'e-hl-galerie', H, C, true)],
  },
  categories: [{ id: 'cat-hl-care', org_id: ORG, sector_key: 'health', code: 'care', parent_id: null }],
  pictograms: [
    {
      id: 'picto-hl-fire-exit', org_id: ORG, category_id: 'cat-hl-care', source: 'internal', standard_ref: 'SF-001',
      svg_path: 'M5 5l10 10M15 5L5 15', registry: 'safety', function_key: null, rules_pack_id: 'rp-test-0001',
    },
  ],
  destinations: [
    k.destination('dest-hl-urgences', 'fp-hl-urgences', 'n-hl-urgences', 'cat-hl-care', 'Urgences', 1),
    k.destination('dest-hl-radio', 'fp-hl-radio', 'n-hl-radio', 'cat-hl-care', 'Imagerie', 2),
    k.destination('dest-hl-chambres', 'fp-hl-chambres', 'n-hl-chambres', 'cat-hl-care', 'Hospitalisation', 3),
    k.destination('dest-hl-consult', 'fp-hl-consult', 'n-hl-c-consult', 'cat-hl-care', 'Consultations', 4),
  ],
  destination_names: [
    ...k.names('dest-hl-urgences', 'Urgences', 'Emergency'),
    ...k.names('dest-hl-radio', 'Imagerie médicale', 'Medical imaging'),
    ...k.names('dest-hl-chambres', 'Hospitalisation', 'Inpatient wards'),
    ...k.names('dest-hl-consult', 'Consultations externes', 'Outpatient clinics'),
  ],
  travel_profiles: [
    k.profile('tp-hl-standard', 'standard', 'Visiteur', [], false),
    k.profile('tp-hl-accessible', 'accessible', 'Visiteur PMR', [], true),
    k.profile('tp-hl-brancard', 'stretcher', 'Brancard', ['stair', 'escalator'], true),
    k.profile('tp-hl-evacuation', 'evacuation', 'Évacuation', ['elevator'], false),
  ],
  ...NO_SIGNAGE,
};
