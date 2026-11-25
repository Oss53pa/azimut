import type { SiteData } from '@azimut/core-model';
import { NO_SIGNAGE, ORG, siteKit } from './site-kit.js';

/**
 * C1 — site de référence `ref-transit`.
 *
 * « Site de transport. Ce qu'il éprouve : pointes de charge, flux avec bagage,
 * nombreuses issues. »
 *
 * - **Nombreuses issues** : six entrées sur le hall, et une issue de secours
 *   sur les quais.
 * - **Flux avec bagage** : un profil qui n'emprunte pas d'escalier, et deux
 *   escaliers mécaniques à sens unique, l'un montant, l'autre descendant.
 * - **Pointes de charge** : *en partie seulement*. Le site porte des capacités
 *   très différentes d'une liaison verticale à l'autre (escalier mécanique,
 *   escalier, ascenseur), seule donnée de charge que le modèle connaisse sur
 *   le graphe (A5.3, `capacity`). Les hypothèses de flux et leurs pointes
 *   vivent dans `flow_hypothesis` (module 03), que `SiteData` ne porte pas ;
 *   aucun moteur de flux ne les lit encore.
 *
 * Le site est valide : `validateGraph` n'y lève aucune anomalie bloquante.
 */
const SITE = 'site-transit-001';
const k = siteKit(SITE, '2026-03-03');

const G = 'bldg-tr-gare';
const QUAIS = 'lvl-tr-quais';
const HALL = 'lvl-tr-hall';
const MEZZ = 'lvl-tr-mezz';

const levels = [
  k.level(QUAIS, G, 'Quais', -1, -6),
  k.level(HALL, G, 'Hall', 0, 0),
  k.level(MEZZ, G, 'Mezzanine', 1, 5.5),
];

const nodes = [
  // — Hall : six entrées —
  k.node('n-tr-hall', HALL, 'junction', 40, 15, 'Hall central'),
  k.node('n-tr-entree-nord', HALL, 'entrance', 40, 40, 'Entrée Nord'),
  k.node('n-tr-entree-sud', HALL, 'entrance', 40, -10, 'Entrée Sud'),
  k.node('n-tr-entree-est', HALL, 'entrance', 90, 15, 'Entrée Est'),
  k.node('n-tr-entree-ouest', HALL, 'entrance', -10, 15, 'Entrée Ouest'),
  k.node('n-tr-entree-bus', HALL, 'entrance', 75, -10, 'Gare routière'),
  k.node('n-tr-entree-taxi', HALL, 'entrance', 5, -10, 'Station de taxis'),
  k.node('n-tr-billetterie', HALL, 'destination_access', 30, 25, 'Billetterie'),
  k.node('n-tr-consigne', HALL, 'destination_access', 50, 25, 'Consigne à bagages'),
  k.node('n-tr-esc-hall', HALL, 'stair', 20, 15, 'Escalier des quais, hall'),
  k.node('n-tr-asc-hall', HALL, 'elevator', 45, 15, 'Ascenseur, hall'),
  k.node('n-tr-montee-hall', HALL, 'escalator', 60, 15, 'Escalier mécanique montant, hall'),
  k.node('n-tr-descente-hall', HALL, 'escalator', 64, 15, 'Escalier mécanique descendant, hall'),
  k.node('n-tr-esc-mezz-hall', HALL, 'stair', 30, 15, 'Escalier de la mezzanine, hall'),
  // — Quais —
  k.node('n-tr-passage', QUAIS, 'junction', 40, 5, 'Passage souterrain'),
  k.node('n-tr-quai-a', QUAIS, 'destination_access', 20, 5, 'Quai A'),
  k.node('n-tr-quai-b', QUAIS, 'destination_access', 60, 5, 'Quai B'),
  k.node('n-tr-esc-quais', QUAIS, 'stair', 20, 15, 'Escalier des quais, quais'),
  k.node('n-tr-asc-quais', QUAIS, 'elevator', 45, 15, 'Ascenseur, quais'),
  k.node('n-tr-montee-quais', QUAIS, 'escalator', 60, 15, 'Escalier mécanique montant, quais'),
  k.node('n-tr-descente-quais', QUAIS, 'escalator', 64, 15, 'Escalier mécanique descendant, quais'),
  k.node('n-tr-secours', QUAIS, 'emergency_exit', 0, 5, 'Issue de secours des quais'),
  // — Mezzanine —
  k.node('n-tr-mezz', MEZZ, 'junction', 40, 15, 'Mezzanine'),
  k.node('n-tr-esc-mezz', MEZZ, 'stair', 30, 15, 'Escalier de la mezzanine, mezzanine'),
  k.node('n-tr-asc-mezz', MEZZ, 'elevator', 45, 15, 'Ascenseur, mezzanine'),
  k.node('n-tr-restauration', MEZZ, 'destination_access', 40, 25, 'Restauration'),
];

const edges = k.edges(nodes, levels, [
  ['e-tr-nord', 'n-tr-entree-nord', 'n-tr-hall', 6],
  ['e-tr-sud', 'n-tr-entree-sud', 'n-tr-hall', 6],
  ['e-tr-est', 'n-tr-entree-est', 'n-tr-hall', 6],
  ['e-tr-ouest', 'n-tr-entree-ouest', 'n-tr-hall', 6],
  ['e-tr-bus', 'n-tr-entree-bus', 'n-tr-hall', 4],
  ['e-tr-taxi', 'n-tr-entree-taxi', 'n-tr-hall', 4],
  ['e-tr-hall-billetterie', 'n-tr-hall', 'n-tr-billetterie', 4],
  ['e-tr-hall-consigne', 'n-tr-hall', 'n-tr-consigne', 4],
  ['e-tr-hall-esc', 'n-tr-hall', 'n-tr-esc-hall', 5],
  ['e-tr-hall-asc', 'n-tr-hall', 'n-tr-asc-hall', 4],
  ['e-tr-hall-montee', 'n-tr-hall', 'n-tr-montee-hall', 4],
  ['e-tr-hall-descente', 'n-tr-hall', 'n-tr-descente-hall', 4],
  ['e-tr-hall-esc-mezz', 'n-tr-hall', 'n-tr-esc-mezz-hall', 4],
  // Liaisons entre le hall et les quais. Les escaliers mécaniques ne vont
  // que dans un sens : la montée part des quais, la descente du hall.
  ['e-tr-esc-quais', 'n-tr-esc-quais', 'n-tr-esc-hall', 3, { accessible: false, evacuation_route: true }],
  ['e-tr-asc-quais', 'n-tr-asc-quais', 'n-tr-asc-hall', 1.6],
  ['e-tr-montee', 'n-tr-montee-quais', 'n-tr-montee-hall', 1, { accessible: false, direction: 'forward' }],
  ['e-tr-descente', 'n-tr-descente-hall', 'n-tr-descente-quais', 1, { accessible: false, direction: 'forward' }],
  // Quais.
  ['e-tr-quai-a-passage', 'n-tr-quai-a', 'n-tr-passage', 5],
  ['e-tr-passage-quai-b', 'n-tr-passage', 'n-tr-quai-b', 5],
  ['e-tr-esc-quai-a', 'n-tr-esc-quais', 'n-tr-quai-a', 3],
  ['e-tr-asc-passage', 'n-tr-asc-quais', 'n-tr-passage', 3],
  ['e-tr-montee-quai-b', 'n-tr-quai-b', 'n-tr-montee-quais', 3],
  ['e-tr-descente-quai-b', 'n-tr-descente-quais', 'n-tr-quai-b', 3],
  ['e-tr-quai-a-secours', 'n-tr-quai-a', 'n-tr-secours', 3, { evacuation_route: true }],
  // Mezzanine.
  ['e-tr-esc-mezz', 'n-tr-esc-mezz-hall', 'n-tr-esc-mezz', 2, { accessible: false, evacuation_route: true }],
  ['e-tr-asc-mezz', 'n-tr-asc-hall', 'n-tr-asc-mezz', 1.6],
  ['e-tr-mezz-esc', 'n-tr-esc-mezz', 'n-tr-mezz', 4],
  ['e-tr-mezz-asc', 'n-tr-asc-mezz', 'n-tr-mezz', 4],
  ['e-tr-mezz-restauration', 'n-tr-mezz', 'n-tr-restauration', 4],
]);

export const refTransit: SiteData = {
  organization: { id: ORG, name: 'Test Organisation', slug: 'test-org' },
  site: {
    id: SITE, org_id: ORG, name: 'Gare de référence', country_code: 'FR', timezone: 'Europe/Paris',
    origin_x_m: -10, origin_y_m: -10, active_langs: ['fr', 'en'], reference_elevation_m: 48,
  },
  rules_bindings: [{ id: 'rb-tr-base', rules_pack_id: 'rp-test-0001', role: 'base' }],
  buildings: [{ id: G, org_id: ORG, site_id: SITE, name: 'Gare', independent_access: true, default_edge_width_m: 4 }],
  levels,
  plan_sources: [k.source('ps-tr-quais', QUAIS, '09:00'), k.source('ps-tr-hall', HALL, '09:05'), k.source('ps-tr-mezz', MEZZ, '09:10')],
  plan_calibrations: [
    k.calibration('cal-tr-quais', 'ps-tr-quais', '10:00'), k.calibration('cal-tr-hall', 'ps-tr-hall', '10:20'),
    k.calibration('cal-tr-mezz', 'ps-tr-mezz', '10:40'),
  ],
  footprints: [
    k.footprint('fp-tr-billetterie', HALL, 'cell', 'H-001', 24, 22, 10, 8),
    k.footprint('fp-tr-consigne', HALL, 'cell', 'H-002', 46, 22, 10, 8),
    k.footprint('fp-tr-quai-a', QUAIS, 'circulation', undefined, 0, 0, 35, 4),
    k.footprint('fp-tr-quai-b', QUAIS, 'circulation', undefined, 45, 0, 35, 4),
    k.footprint('fp-tr-restauration', MEZZ, 'cell', 'M-001', 34, 22, 12, 8),
  ],
  volumes: [
    k.volume('vol-tr-billetterie', 'fp-tr-billetterie', 0, 5.5), k.volume('vol-tr-consigne', 'fp-tr-consigne', 0, 5.5),
    k.volume('vol-tr-restauration', 'fp-tr-restauration', 5.5, 4),
  ],
  graph: {
    nodes,
    edges,
    vertical_links: [
      // Les capacités disent les pointes : l'escalier mécanique en écoule
      // dix fois plus que l'ascenseur.
      k.link('vl-tr-esc-quais', 'e-tr-esc-quais', 'stair', 80, false),
      k.link('vl-tr-asc-quais', 'e-tr-asc-quais', 'elevator', 13, true),
      k.link('vl-tr-montee', 'e-tr-montee', 'escalator', 140, false),
      k.link('vl-tr-descente', 'e-tr-descente', 'escalator', 140, false),
      k.link('vl-tr-esc-mezz', 'e-tr-esc-mezz', 'stair', 60, false),
      k.link('vl-tr-asc-mezz', 'e-tr-asc-mezz', 'elevator', 13, true),
    ],
    building_links: [],
  },
  categories: [
    { id: 'cat-tr-transport', org_id: ORG, sector_key: 'transport', code: 'platform', parent_id: null },
    { id: 'cat-tr-service', org_id: ORG, sector_key: 'transport', code: 'service', parent_id: null },
  ],
  pictograms: [
    {
      id: 'picto-tr-fire-exit', org_id: ORG, category_id: 'cat-tr-service', source: 'internal', standard_ref: 'SF-001',
      svg_path: 'M5 5l10 10M15 5L5 15', registry: 'safety', function_key: null, rules_pack_id: 'rp-test-0001',
    },
  ],
  destinations: [
    k.destination('dest-tr-quai-a', 'fp-tr-quai-a', 'n-tr-quai-a', 'cat-tr-transport', 'Quai A', 1),
    k.destination('dest-tr-quai-b', 'fp-tr-quai-b', 'n-tr-quai-b', 'cat-tr-transport', 'Quai B', 2),
    k.destination('dest-tr-billetterie', 'fp-tr-billetterie', 'n-tr-billetterie', 'cat-tr-service', 'Billetterie', 3),
    k.destination('dest-tr-consigne', 'fp-tr-consigne', 'n-tr-consigne', 'cat-tr-service', 'Consigne', 4),
    k.destination('dest-tr-restauration', 'fp-tr-restauration', 'n-tr-restauration', 'cat-tr-service', 'Restauration', 5),
  ],
  destination_names: [
    ...k.names('dest-tr-quai-a', 'Quai A', 'Platform A'),
    ...k.names('dest-tr-quai-b', 'Quai B', 'Platform B'),
    ...k.names('dest-tr-billetterie', 'Billetterie', 'Ticket office'),
    ...k.names('dest-tr-consigne', 'Consigne à bagages', 'Left luggage'),
    ...k.names('dest-tr-restauration', 'Restauration', 'Food court'),
  ],
  travel_profiles: [
    k.profile('tp-tr-standard', 'standard', 'Voyageur', [], false),
    k.profile('tp-tr-accessible', 'accessible', 'Voyageur PMR', [], true),
    k.profile('tp-tr-bagage', 'luggage', 'Voyageur avec bagage', ['stair'], false),
    k.profile('tp-tr-evacuation', 'evacuation', 'Évacuation', ['elevator', 'escalator'], false),
  ],
  ...NO_SIGNAGE,
};
