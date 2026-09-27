/**
 * Jeu de démonstration du module 05, servi par le dépôt de référence.
 *
 * Données synthétiques : aucun annonceur, aucun contrat réel. Il tient la
 * place des tables de 0045 quand aucune base n'est configurée, et l'écran le
 * dit. Il simule aussi ce que la base n'a pas encore : une file de réception
 * de visuels, pour que l'assainissement (M05.R5, partie N) s'exerce sur des fichiers
 * reçus, et une fiche technique, que rien ne génère encore (H4.2).
 */
import type { AdRegistry } from '@azimut/core-model';
import type { CreativeSpec } from '../domain/ad-creative-control.js';
import type { AdvertisingData, ReceivedCreative } from './advertising-data.js';

/**
 * Ni l'un ni l'autre ne porte de couleur : A2.4 interdit toute couleur écrite
 * en dur hors des jetons de thème, jeu d'essai compris, et ce qui est éprouvé
 * ici n'est pas le remplissage mais ce que l'assainisseur retire.
 *
 * Un SVG reçu d'un annonceur, porteur de ce que l'assainissement doit retirer :
 * un script, un gestionnaire d'événement, une image distante, des métadonnées
 * d'outil. Aucun de ces fragments n'est exécutable ici — c'est du texte dans
 * une chaîne, que `sanitizeSvg` retire avant tout stockage.
 *
 * Il est nettoyé, non refusé : `sanitizeSvg` ne refuse un fichier que sur sa
 * taille ou sa complexité, et un jeu d'essai ne va pas porter cinq mégaoctets
 * pour le démontrer. Ce refus-là est éprouvé par test, avec une configuration
 * serrée.
 */
const SVG_WITH_SCRIPT = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40">',
  '<metadata>Outil de PAO 12.4</metadata>',
  '<script>alert(1)</script>',
  '<rect x="0" y="0" width="100" height="40" onclick="alert(2)"/>',
  '<image xlink:href="https://exemple.invalide/fond.png" x="0" y="0" width="100" height="40"/>',
  '</svg>',
].join('');

/** Le même visuel, propre : rien à retirer. */
const SVG_CLEAN = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40">',
  '<rect x="0" y="0" width="100" height="40"/>',
  '<text x="8" y="26" font-size="14">Vaudel</text>',
  '</svg>',
].join('');

const REGISTRY: AdRegistry = {
  placements: [
    { id: 'AP-N-1-03', code: 'AP-N-1-03', level_id: 'N-1', node_id: null, typology_key: 'caisson_lumineux', area_m2: 2 },
    { id: 'AP-N0-01', code: 'AP-N0-01', level_id: 'N0', node_id: null, typology_key: 'caisson_lumineux', area_m2: 2 },
    { id: 'AP-N0-04', code: 'AP-N0-04', level_id: 'N0', node_id: null, typology_key: 'totem_numerique', area_m2: 1.4 },
    { id: 'AP-N1-02', code: 'AP-N1-02', level_id: 'N1', node_id: null, typology_key: 'bache_galerie', area_m2: 6 },
    { id: 'AP-N2-07', code: 'AP-N2-07', level_id: 'N2', node_id: null, typology_key: 'mobilier', area_m2: 1 },
  ],
  /**
   * Deux réservations fermes se chevauchent sur AP-N0-04 : le conflit est
   * calculé par `guardPlacementBookings`, il n'est pas écrit ici.
   */
  bookings: [
    { id: 'bk-0101', placement_id: 'AP-N0-01', state: 'occupied', from_date: '2026-09-01', to_date: '2026-12-31', advertiser_name: 'Groupe Vaudel' },
    { id: 'bk-0102', placement_id: 'AP-N0-04', state: 'reserved', from_date: '2026-10-01', to_date: '2026-11-30', advertiser_name: 'Studio Lampas' },
    { id: 'bk-0103', placement_id: 'AP-N0-04', state: 'reserved', from_date: '2026-11-01', to_date: '2027-01-31', advertiser_name: 'Groupe Vaudel' },
    { id: 'bk-0104', placement_id: 'AP-N1-02', state: 'occupied', from_date: '2026-09-15', to_date: '2027-02-28', advertiser_name: 'Maison Berthier' },
    { id: 'bk-0105', placement_id: 'AP-N2-07', state: 'option', from_date: '2026-10-01', to_date: '2026-12-31', advertiser_name: null },
    { id: 'bk-0106', placement_id: 'AP-N-1-03', state: 'maintenance', from_date: '2026-09-10', to_date: '2026-09-20', advertiser_name: null },
  ],
  options: [
    { id: 'op-0044', placement_id: 'AP-N2-07', expires_at: '2026-09-22' },
    { id: 'op-0045', placement_id: 'AP-N-1-03', expires_at: '2026-09-05' },
    { id: 'op-0046', placement_id: 'AP-N0-04', expires_at: '2026-12-01' },
  ],
  // Rien n'est encore enregistré : les visuels du jeu attendent en réception.
  creatives: [],
};

/** Fiche technique d'un emplacement : elle est générée, jamais saisie (H4.2). */
const CREATIVE_SPEC: CreativeSpec = {
  format: 'pdf',
  min_resolution_dpi: 150,
  safe_zone_mm: 10,
  color_profile: 'CMYK',
  max_weight_bytes: 50 * 1024 * 1024,
};

const RECEPTION: readonly ReceivedCreative[] = [
  {
    placement_id: 'AP-N0-01',
    verdict: 'refused',
    creative: {
      id: 'cr-0231',
      format: 'pdf',
      resolution_dpi: 118,
      safe_zone_mm: 10,
      color_profile: 'CMYK',
      weight_bytes: 12_400_000,
    },
    // Format binaire : l'assainissement fait autorité côté serveur (E14.1).
    payload: { kind: 'binary' },
  },
  {
    placement_id: 'AP-N1-02',
    verdict: 'human_review',
    creative: {
      id: 'cr-0244',
      format: 'pdf',
      resolution_dpi: 300,
      safe_zone_mm: 12,
      color_profile: 'CMYK',
      weight_bytes: 28_900_000,
    },
    payload: { kind: 'binary' },
  },
  {
    placement_id: 'AP-N2-07',
    verdict: 'approved',
    creative: {
      id: 'cr-0250',
      format: 'pdf',
      resolution_dpi: 220,
      safe_zone_mm: 14,
      color_profile: 'CMYK',
      weight_bytes: 6_100_000,
    },
    // SVG propre : assaini ici, donc affichable.
    payload: { kind: 'svg', source: SVG_CLEAN },
  },
  {
    placement_id: 'AP-N0-04',
    verdict: 'refused',
    creative: {
      id: 'cr-0255',
      format: 'png',
      resolution_dpi: 96,
      safe_zone_mm: 4,
      color_profile: 'RGB',
      weight_bytes: 61_000_000,
    },
    // Binaire, et non conforme sur les cinq axes de la fiche : c'est le cas
    // M05.R6 (partie N), celui que l'assainissement ne concerne pas.
    payload: { kind: 'binary' },
  },
  {
    placement_id: 'AP-N-1-03',
    verdict: 'human_review',
    creative: {
      id: 'cr-0261',
      format: 'svg',
      resolution_dpi: 300,
      safe_zone_mm: 12,
      color_profile: 'CMYK',
      weight_bytes: 900_000,
    },
    // M05.R5 (partie N) en situation : ce qui est stocké n'est pas ce qui a été reçu. Le
    // script, le gestionnaire d'événement, l'entité externe et l'image
    // distante sont retirés ; ce qui reste est rendable, et l'écran dit ce qui
    // a été retiré.
    payload: { kind: 'svg', source: SVG_WITH_SCRIPT },
  },
];

export const REFERENCE_ADVERTISING: AdvertisingData = {
  registry: REGISTRY,
  reception: RECEPTION,
  creative_spec: CREATIVE_SPEC,
};
