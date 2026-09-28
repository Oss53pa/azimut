/**
 * H8 — le budget tel que la base le porte (migration 0043) : coûts de
 * référence de l'organisation, lignes budgétaires du site.
 *
 * Un montant est un entier d'unité mineure avec sa devise, jamais un
 * flottant d'unité majeure (H8). Un coût absent reste absent, jamais zéro :
 * c'est ce qui permet à `auditCostReferences` de le relever.
 *
 * Comme le vocabulaire, ce registre ne rejoint pas `SiteData` : il se lit à
 * part, par les écrans du module 09.
 */

/** Montant en unité mineure entière, avec sa devise ISO 4217. */
export type Money = {
  readonly minor: number;
  readonly currency: string;
};

export type CostReference = {
  readonly id: string;
  readonly typology_key: string;
  readonly substrate_key: string;
  readonly manufacturer_name: string | null;
  /** `null` : la typologie n'est pas chiffrée, et l'écran le dit. */
  readonly unit_cost: Money | null;
  /** `AAAA-MM-JJ`, date d'effet du coût, ou `null`. */
  readonly since: string | null;
};

export type BudgetLine = {
  readonly id: string;
  /** Clé de phase, traduite par l'écran quand il la connaît. */
  readonly phase_key: string;
  /** Le lot de fabrication (0042) auquel la ligne se rattache, s'il y en a un. */
  readonly lot_id: string | null;
  readonly estimated: Money | null;
  readonly quoted: Money | null;
  readonly actual: Money | null;
};

export type BudgetRegistry = {
  readonly cost_references: readonly CostReference[];
  readonly budget_lines: readonly BudgetLine[];
};

export const EMPTY_BUDGET_REGISTRY: BudgetRegistry = { cost_references: [], budget_lines: [] };
