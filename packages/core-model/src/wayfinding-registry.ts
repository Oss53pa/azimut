/**
 * N2.2 — le registre du wayfinding : zones d'orientation, règles de nommage,
 * niveaux d'information par typologie. Tables de la migration 0027.
 *
 * Comme le vocabulaire, ce registre ne rejoint pas `SiteData` : un site se
 * charge et se dessine sans lui, et il se lit à part. Un registre vide dit que
 * le site ne déclare rien — il ne fait réussir aucun contrôle.
 *
 * Les énumérés recopient les CHECK de 0027 ; un test structurel vérifie que
 * les deux listes coïncident.
 */

export const ORIENTATION_ZONE_KINDS = ['mall', 'entrance', 'core', 'service', 'outdoor'] as const;
export type OrientationZoneKind = (typeof ORIENTATION_ZONE_KINDS)[number];

export const NAMING_TARGETS = ['level', 'zone', 'door', 'core', 'parking'] as const;
export type NamingTarget = (typeof NAMING_TARGETS)[number];

export const NAMING_SCOPES = ['site', 'building', 'level'] as const;
export type NamingScope = (typeof NAMING_SCOPES)[number];

/** H2.3 — quatre niveaux d'information, du plus général au plus local. */
export const INFORMATION_LEVELS = [1, 2, 3, 4] as const;
export type InformationLevelRank = (typeof INFORMATION_LEVELS)[number];

export type OrientationZone = {
  readonly id: string;
  readonly code: string;
  readonly name_fr: string;
  readonly name_en: string;
  readonly kind: OrientationZoneKind;
  /** Empreintes couvertes par la zone ; la zone n'a pas de géométrie propre. */
  readonly footprint_ids: readonly string[];
};

export type NamingRule = {
  readonly id: string;
  readonly target: NamingTarget;
  readonly pattern: string;
  readonly max_length: number;
  readonly uniqueness_scope: NamingScope;
};

/** Un niveau d'information déclaré pour une typologie, par sa clé. */
export type InformationLevelBinding = {
  readonly typology_key: string;
  readonly level: InformationLevelRank;
};

export type WayfindingRegistry = {
  readonly zones: readonly OrientationZone[];
  readonly naming_rules: readonly NamingRule[];
  readonly information_levels: readonly InformationLevelBinding[];
};

/** Un site qui ne déclare rien. Explicite, pour ne pas confondre avec un oubli. */
export const EMPTY_WAYFINDING_REGISTRY: WayfindingRegistry = {
  zones: [],
  naming_rules: [],
  information_levels: [],
};

export function isOrientationZoneKind(value: string): value is OrientationZoneKind {
  return ORIENTATION_ZONE_KINDS.some(k => k === value);
}

export function isNamingTarget(value: string): value is NamingTarget {
  return NAMING_TARGETS.some(k => k === value);
}

export function isNamingScope(value: string): value is NamingScope {
  return NAMING_SCOPES.some(k => k === value);
}

export function isInformationLevelRank(value: number): value is InformationLevelRank {
  return INFORMATION_LEVELS.some(k => k === value);
}
