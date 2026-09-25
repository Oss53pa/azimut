/**
 * H4 — la régie publicitaire telle que la base la porte (migration 0045) :
 * emplacements, réservations, options, visuels enregistrés.
 *
 * L'état « libre » d'un emplacement ne se stocke pas : c'est l'absence de
 * réservation. Le chevauchement de deux réservations fermes n'est pas
 * interdit en base (décision du 25/09/2026, proposition de schéma 7.7) : il
 * s'enregistre, et le garde `guardPlacementBookings` le relève en bloquant.
 *
 * Comme le vocabulaire, ce registre ne rejoint pas `SiteData` : il se lit à
 * part, par les écrans du module 05. Les énumérés recopient les CHECK de 0045 ;
 * un test structurel vérifie que les listes coïncident.
 */

export const AD_BOOKING_STATES = ['option', 'reserved', 'occupied', 'maintenance', 'retired'] as const;
export type AdBookingState = (typeof AD_BOOKING_STATES)[number];

export const AD_SANITATION_STATES = ['clean', 'failed', 'deferred'] as const;
export type AdSanitationState = (typeof AD_SANITATION_STATES)[number];

export const AD_CREATIVE_VERDICTS = ['approved', 'refused', 'human_review'] as const;
export type AdCreativeVerdict = (typeof AD_CREATIVE_VERDICTS)[number];

export type AdPlacement = {
  readonly id: string;
  /** Code lisible, unique par site, par exemple `AP-N0-01`. */
  readonly code: string;
  readonly level_id: string;
  readonly node_id: string | null;
  readonly typology_key: string;
  readonly area_m2: number;
};

export type AdBooking = {
  readonly id: string;
  readonly placement_id: string;
  readonly state: AdBookingState;
  /** `AAAA-MM-JJ`, bornes incluses. */
  readonly from_date: string;
  readonly to_date: string;
  readonly advertiser_name: string | null;
};

export type AdOption = {
  readonly id: string;
  readonly placement_id: string;
  /** `AAAA-MM-JJ` : l'option tombe à cette date. */
  readonly expires_at: string;
};

/** Un visuel reçu puis enregistré ; son assainissement a eu lieu à la réception (M05.R5, partie N). */
export type AdCreative = {
  readonly id: string;
  readonly placement_id: string;
  readonly format: string;
  readonly resolution_dpi: number;
  readonly safe_zone_mm: number;
  readonly color_profile: string;
  readonly weight_bytes: number;
  readonly storage_path: string | null;
  readonly sanitation: AdSanitationState;
  readonly verdict: AdCreativeVerdict;
  /** ISO-8601, tel que la base le rend. */
  readonly received_at: string;
};

export type AdRegistry = {
  readonly placements: readonly AdPlacement[];
  readonly bookings: readonly AdBooking[];
  readonly options: readonly AdOption[];
  readonly creatives: readonly AdCreative[];
};

export const EMPTY_AD_REGISTRY: AdRegistry = { placements: [], bookings: [], options: [], creatives: [] };

export function isAdBookingState(value: string): value is AdBookingState {
  return (AD_BOOKING_STATES as readonly string[]).includes(value);
}

export function isAdSanitationState(value: string): value is AdSanitationState {
  return (AD_SANITATION_STATES as readonly string[]).includes(value);
}

export function isAdCreativeVerdict(value: string): value is AdCreativeVerdict {
  return (AD_CREATIVE_VERDICTS as readonly string[]).includes(value);
}
