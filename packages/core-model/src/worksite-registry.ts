/**
 * H6 — le chantier tel que la base le porte (migration 0042) : lots de
 * fabrication, créneaux de pose, réserves de pose.
 *
 * Comme le vocabulaire, ce registre ne rejoint pas `SiteData` : il se lit à
 * part, par les écrans du module 07. Le nombre de supports d'un lot ou d'un
 * créneau se lit dans ses `support_ids` ; il ne se stocke pas. Les énumérés
 * recopient les CHECK de 0042 ; un test structurel vérifie que les listes
 * coïncident.
 */

export const FABRICATION_LOT_STATES = ['ordered', 'in_production', 'delivered', 'installed'] as const;
export type FabricationLotState = (typeof FABRICATION_LOT_STATES)[number];

export type FabricationLot = {
  readonly id: string;
  readonly code: string;
  readonly manufacturer_name: string;
  readonly state: FabricationLotState;
  /** Supports du lot, triés ; un support appartient à un lot au plus. */
  readonly support_ids: readonly string[];
};

export type InstallSlot = {
  readonly id: string;
  readonly zone_label: string;
  /** Jour de pose, `AAAA-MM-JJ`, ou `null` pour un créneau à planifier. */
  readonly planned_on: string | null;
  readonly night_work: boolean;
  readonly support_ids: readonly string[];
};

export type RecordedReserve = {
  readonly id: string;
  readonly support_id: string;
  readonly lot_id: string;
  /** Clé du constat, traduite par l'écran quand il la connaît. */
  readonly observation_key: string;
  readonly observed_by: string;
  /** ISO-8601, tel que la base le rend. */
  readonly observed_at: string;
  /** `null` tant que la réserve est ouverte ; elle ne se supprime pas. */
  readonly lifted_at: string | null;
  readonly photo_path: string | null;
};

export type WorksiteRegistry = {
  readonly lots: readonly FabricationLot[];
  readonly slots: readonly InstallSlot[];
  readonly reserves: readonly RecordedReserve[];
};

export const EMPTY_WORKSITE_REGISTRY: WorksiteRegistry = { lots: [], slots: [], reserves: [] };

export function isFabricationLotState(value: string): value is FabricationLotState {
  return (FABRICATION_LOT_STATES as readonly string[]).includes(value);
}
