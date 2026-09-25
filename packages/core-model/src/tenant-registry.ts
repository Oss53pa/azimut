/**
 * H5 — les enseignes locataires telles que la base les porte (migration
 * 0046) : règlement d'enseigne du site, dossiers d'enseigne et leurs pièces.
 *
 * Le règlement est versionné par sa date d'effet : un dossier s'instruit
 * contre la version en vigueur à son dépôt. Un dossier se rattache à la
 * cellule réelle par sa destination ; le locataire et le code de cellule se
 * lisent dans l'annuaire du site, ils ne se recopient pas.
 *
 * Comme le vocabulaire, ce registre ne rejoint pas `SiteData` : il se lit à
 * part, par les écrans du module 06. Les énumérés recopient les CHECK de 0046 ;
 * un test structurel vérifie que les listes coïncident.
 */

export const TENANT_DOSSIER_STATES = ['submitted', 'instructing', 'approved', 'refused'] as const;
export type TenantDossierState = (typeof TENANT_DOSSIER_STATES)[number];

export type TenantSignRegulation = {
  readonly id: string;
  /** `AAAA-MM-JJ` : la version s'applique aux dossiers déposés à partir de cette date. */
  readonly effective_from: string;
  /** `null` : l'axe n'est pas borné. */
  readonly max_height_mm: number | null;
  readonly max_overhang_mm: number | null;
  /** Vide : aucune restriction sur l'axe. */
  readonly allowed_materials: readonly string[];
  readonly allowed_lighting: readonly string[];
  readonly forbidden_features: readonly string[];
};

export type TenantSignPart = {
  readonly key: string;
  readonly provided: boolean;
  readonly storage_path: string | null;
};

export type TenantSignDossier = {
  readonly id: string;
  readonly destination_id: string;
  readonly state: TenantDossierState;
  /** `AAAA-MM-JJ`. */
  readonly submitted_on: string;
  readonly height_mm: number;
  readonly overhang_mm: number;
  readonly material: string;
  readonly lighting: string;
  readonly features: readonly string[];
  readonly parts: readonly TenantSignPart[];
};

export type TenantRegistry = {
  /** Du plus ancien au plus récent, par date d'effet. */
  readonly regulations: readonly TenantSignRegulation[];
  readonly dossiers: readonly TenantSignDossier[];
};

export const EMPTY_TENANT_REGISTRY: TenantRegistry = { regulations: [], dossiers: [] };

export function isTenantDossierState(value: string): value is TenantDossierState {
  return (TENANT_DOSSIER_STATES as readonly string[]).includes(value);
}

/**
 * La version du règlement en vigueur à une date : la plus récente dont la
 * date d'effet ne la dépasse pas. `null` quand aucune ne l'est encore — le
 * dossier ne s'instruit alors contre rien, et l'écran le dit.
 */
export function regulationInForce(
  regulations: readonly TenantSignRegulation[],
  onIso: string,
): TenantSignRegulation | null {
  let found: TenantSignRegulation | null = null;
  for (const r of regulations) {
    if (r.effective_from > onIso) continue;
    if (found === null || r.effective_from > found.effective_from
      || (r.effective_from === found.effective_from && r.id > found.id)) found = r;
  }
  return found;
}
