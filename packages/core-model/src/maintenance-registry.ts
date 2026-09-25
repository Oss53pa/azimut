/**
 * A5.7 — la couche de divergence telle que la base la porte (migration 0006) :
 * supports posés, divergences enregistrées, ordres de travaux.
 *
 * Ce registre suit la base, pas A5.7, là où les deux diffèrent : la
 * divergence pend au support posé et porte `notes`, le coût estimé d'un ordre
 * de travaux est un décimal d'unité majeure. Ces écarts attendent une
 * décision (proposition de schéma, 3.2 et 3.4) ; les lire tels quels ne
 * tranche rien et ne transforme aucune donnée.
 *
 * Comme le vocabulaire, ce registre ne rejoint pas `SiteData` : il se lit à
 * part, par les écrans du module 08. Les énumérés recopient les CHECK de 0006 ;
 * un test structurel vérifie que les listes coïncident.
 */

export const DIVERGENCE_KINDS = [
  'outdated_content', 'wrong_orientation', 'undersized', 'missing', 'superfluous', 'damaged',
] as const;
export type DivergenceKind = (typeof DIVERGENCE_KINDS)[number];

export const WORK_ORDER_STATES = ['draft', 'issued', 'in_progress', 'done', 'cancelled'] as const;
export type WorkOrderState = (typeof WORK_ORDER_STATES)[number];

export type InstalledSupport = {
  readonly id: string;
  readonly support_id: string;
  /** ISO-8601, tel que la base le rend. */
  readonly installed_at: string;
  readonly photo_path: string | null;
  readonly installer_notes: string | null;
};

export type RecordedDivergence = {
  readonly id: string;
  readonly installed_support_id: string;
  readonly kind: DivergenceKind;
  readonly detected_at: string;
  /** `null` tant que la divergence est ouverte. */
  readonly resolved_at: string | null;
  readonly notes: string | null;
};

export type WorkOrder = {
  readonly id: string;
  /** JSON libre, cité tel quel : aucun moteur ne l'interprète encore. */
  readonly scope: unknown;
  /**
   * Coût estimé, texte décimal exact tel que la base le rend, en unité
   * majeure. H8 veut l'unité mineure entière ; la conversion est une décision
   * en attente (3.4), pas une lecture.
   */
  readonly estimated_cost: string | null;
  readonly currency: string;
  readonly state: WorkOrderState;
  readonly created_at: string;
  readonly closed_at: string | null;
};

export type MaintenanceRegistry = {
  readonly installed: readonly InstalledSupport[];
  readonly divergences: readonly RecordedDivergence[];
  readonly work_orders: readonly WorkOrder[];
};

export const EMPTY_MAINTENANCE_REGISTRY: MaintenanceRegistry = {
  installed: [],
  divergences: [],
  work_orders: [],
};

export function isDivergenceKind(value: string): value is DivergenceKind {
  return (DIVERGENCE_KINDS as readonly string[]).includes(value);
}

export function isWorkOrderState(value: string): value is WorkOrderState {
  return (WORK_ORDER_STATES as readonly string[]).includes(value);
}
