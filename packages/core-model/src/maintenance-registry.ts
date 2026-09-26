/**
 * A5.7 — la couche de divergence telle que la base la porte : supports posés,
 * divergences enregistrées, ordres de travaux (migrations 0006 et 0041).
 *
 * La divergence désigne un support, ou le nœud d'un point de décision non
 * couvert (0041, décision sur la proposition de schéma 3.2, options 1 et 3) ;
 * la pose n'y est plus qu'un rattachement facultatif. La pose porte sa
 * version, son état et son relevé (0047). Le coût estimé d'un ordre de travaux
 * est un entier d'unité mineure avec sa devise (0048, H8).
 *
 * Comme le vocabulaire, ce registre ne rejoint pas `SiteData` : il se lit à
 * part, par les écrans du module 08. Les énumérés recopient les CHECK de 0006 ;
 * un test structurel vérifie que les listes coïncident.
 */

import type { Money } from './budget-registry.js';

export const DIVERGENCE_KINDS = [
  'outdated_content', 'wrong_orientation', 'undersized', 'missing', 'superfluous', 'damaged',
] as const;
export type DivergenceKind = (typeof DIVERGENCE_KINDS)[number];

export const INSTALLED_CONDITIONS = ['good', 'worn', 'damaged', 'missing'] as const;
export type InstalledCondition = (typeof INSTALLED_CONDITIONS)[number];

export const WORK_ORDER_STATES = ['draft', 'issued', 'in_progress', 'done', 'cancelled'] as const;
export type WorkOrderState = (typeof WORK_ORDER_STATES)[number];

export type InstalledSupport = {
  readonly id: string;
  readonly support_id: string;
  /** ISO-8601, tel que la base le rend. */
  readonly installed_at: string;
  readonly photo_path: string | null;
  readonly installer_notes: string | null;
  /** Version du support posée, ou `null` si elle n'a pas été relevée (0047). */
  readonly installed_version: number | null;
  /** État constaté au dernier relevé, ou `null` s'il n'y en a pas eu. */
  readonly condition: InstalledCondition | null;
  readonly surveyed_by: string | null;
  readonly surveyed_at: string | null;
};

export type RecordedDivergence = {
  readonly id: string;
  /**
   * Le support visé, ou `null` pour un point non couvert. La base garantit
   * qu'au moins l'un de `support_id` et `node_id` est renseigné (0041).
   */
  readonly support_id: string | null;
  /** Le nœud d'un point de décision sans support, hors A5.7 (0041). */
  readonly node_id: string | null;
  /** La pose sur laquelle la divergence a été relevée, s'il y en a une. */
  readonly installed_support_id: string | null;
  readonly kind: DivergenceKind;
  readonly detected_at: string;
  /** `null` tant que la divergence est ouverte. */
  readonly resolved_at: string | null;
  /** JSON libre (A5.7). Les anciennes notes y sont sous la clé `notes`. */
  readonly detail: Readonly<Record<string, unknown>> | null;
};

export type WorkOrder = {
  readonly id: string;
  /** JSON libre, cité tel quel : aucun moteur ne l'interprète encore. */
  readonly scope: unknown;
  /** Coût estimé en unité mineure avec sa devise (H8), ou `null` s'il n'est pas chiffré. */
  readonly estimated_cost: Money | null;
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

export function isInstalledCondition(value: string): value is InstalledCondition {
  return (INSTALLED_CONDITIONS as readonly string[]).includes(value);
}

export function isWorkOrderState(value: string): value is WorkOrderState {
  return (WORK_ORDER_STATES as readonly string[]).includes(value);
}
