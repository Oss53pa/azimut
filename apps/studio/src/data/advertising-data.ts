/**
 * H4 — ce que les écrans de la régie lisent : le registre de la base, et ce
 * qui n'y est pas encore.
 *
 * Deux choses n'ont pas de table, et ce n'est pas un oubli :
 *
 * - la file de réception. Un visuel reçu passe par l'assainissement avant
 *   d'être enregistré (M05.R5, partie N) ; tant qu'il ne l'est pas, il n'est pas en
 *   base. Aucun canal de dépôt n'existe encore côté base : la file y est vide.
 *   Le dépôt de référence la simule, pour que l'assainissement s'exerce ;
 * - la fiche technique. Elle est générée, jamais saisie (H4.2), et aucun
 *   générateur n'existe : côté base elle est absente, et les écrans disent
 *   que la conformité n'est pas contrôlée.
 */
import type { AdCreativeVerdict, AdRegistry } from '@azimut/core-model';
import type { CreativeReception } from '../domain/ad-creative-intake.js';
import type { CreativeSpec } from '../domain/ad-creative-control.js';

/** Un visuel reçu, pas encore enregistré. */
export type ReceivedCreative = CreativeReception & {
  readonly placement_id: string;
  readonly verdict: AdCreativeVerdict;
};

export type AdvertisingData = {
  readonly registry: AdRegistry;
  readonly reception: readonly ReceivedCreative[];
  readonly creative_spec: CreativeSpec | null;
};
