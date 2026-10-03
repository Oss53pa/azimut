/**
 * M1bis (partie M) — la structure d'un site : bâtiments et niveaux.
 *
 * « Sans cet écran, un site reste au bâtiment et au niveau créés par le
 * formulaire de M1. La tâche T-1.5 et l'outil de liaison verticale sont alors
 * impossibles. »
 *
 * Ce module juge et construit les commandes. Il n'écrit pas, ne lit ni
 * l'horloge ni le magasin, et ne connaît pas l'écran.
 *
 * Rien n'est complété d'office. Le rang d'un niveau est *proposé* par
 * `nextOrdinal`, que l'écran affiche dans un champ saisissable ; l'altitude,
 * elle, ne se propose pas. Une hauteur d'étage par défaut serait une constante
 * inventée, et elle décide de la longueur des liaisons verticales (M01.S6).
 */
import type { EntityCommand, Finding, Outcome } from '@azimut/core-model';
import { buildCommand, roundMetres } from '@azimut/core-model';

/** M1bis : « Nom | texte | requis, 1 à 80 caractères, unique par site ». */
export const BUILDING_NAME_MIN = 1;
export const BUILDING_NAME_MAX = 80;

export type BuildingDraft = {
  readonly name: string;
  readonly independentAccess: boolean;
  /** M1bis : facultative, héritée par les arêtes du bâtiment (N1.2). */
  readonly defaultEdgeWidthM: number | null;
};

/**
 * Un niveau en cours de saisie, tel que l'écran le tient.
 *
 * Rang et altitude sont facultatifs *au brouillon* et requis à la création :
 * l'écran garde ce que l'opérateur a tapé, et `levelDraftComplete` dit si
 * l'action est possible. C'est la prévention plutôt que le refus — M1bis donne
 * un code d'anomalie au nom et au rang en double, aucun à l'absence de rang ou
 * d'altitude, et en inventer un ajouterait au catalogue que le document vient
 * de compléter.
 */
export type LevelDraft = {
  readonly name: string;
  readonly ordinal: number | null;
  readonly elevationM: number | null;
};

/** Un brouillon complet : les trois champs requis de M1bis sont saisis. */
export function levelDraftComplete(draft: LevelDraft): boolean {
  return draft.name.trim().length > 0
    && draft.ordinal !== null && Number.isInteger(draft.ordinal)
    && draft.elevationM !== null && Number.isFinite(draft.elevationM);
}

export type AcceptedBuilding = {
  readonly name: string;
  readonly independentAccess: boolean;
  readonly defaultEdgeWidthM: number | null;
};

export type AcceptedLevel = {
  readonly name: string;
  readonly ordinal: number;
  readonly elevationM: number;
};

/** Ce que la structure existante oppose à un ajout ou à un renommage. */
export type StructureContext = {
  /** Noms des bâtiments du site, hors celui qu'on modifie. */
  readonly buildingNames: readonly string[];
  /** Noms des niveaux du bâtiment visé, hors celui qu'on modifie. */
  readonly levelNames: readonly string[];
  /** Rangs des niveaux du bâtiment visé, hors celui qu'on modifie. */
  readonly ordinals: readonly number[];
};

export const EMPTY_STRUCTURE: StructureContext = {
  buildingNames: [], levelNames: [], ordinals: [],
};

/**
 * L'unicité se juge sur le nom normalisé.
 *
 * Deux bâtiments qui ne diffèrent que par une casse ou une espace de bord sont
 * le même nom pour un lecteur, et c'est un lecteur qui s'orientera dessus.
 * Même règle que pour le nom d'un site (M1, partie M).
 */
function normalise(value: string): string {
  return value.trim().toLocaleLowerCase('fr');
}

function finding(code: string, params: Record<string, string | number>): Finding {
  return {
    code,
    severity: 'blocking',
    entity: null,
    params,
    ruleRef: 'partieM-M1bis (partie M)',
  };
}

function checkName(
  name: string,
  existing: readonly string[],
  min: number,
  max: number,
): readonly Finding[] {
  const trimmed = name.trim();
  if (trimmed.length < min || trimmed.length > max) {
    return [finding('DATA.NAME_REQUIRED', { length: trimmed.length, min, max })];
  }
  const key = normalise(trimmed);
  return existing.some(other => normalise(other) === key)
    ? [finding('DATA.NAME_DUPLICATE', { name: trimmed })]
    : [];
}

export function acceptBuilding(
  draft: BuildingDraft,
  context: StructureContext,
): Outcome<AcceptedBuilding> {
  // La largeur utile par défaut n'est pas contrôlée ici, et ce n'est pas un
  // oubli : M1bis la donne facultative et sans code d'anomalie. Le contrôle
  // d'une largeur appartient à l'arête, où M4 (partie M) l'exige supérieure à
  // zéro. Le juger deux fois ferait deux définitions d'une même règle.
  const findings = [
    ...checkName(draft.name, context.buildingNames, BUILDING_NAME_MIN, BUILDING_NAME_MAX),
  ];
  if (findings.length > 0) return { ok: false, findings };

  return {
    ok: true,
    value: {
      name: draft.name.trim(),
      independentAccess: draft.independentAccess,
      defaultEdgeWidthM: draft.defaultEdgeWidthM === null
        ? null
        : roundMetres(draft.defaultEdgeWidthM),
    },
    warnings: [],
  };
}

export function acceptLevel(
  draft: LevelDraft,
  context: StructureContext,
): Outcome<AcceptedLevel> {
  // Un brouillon incomplet n'est pas une anomalie : l'action est refusée par
  // l'écran, qui tient `levelDraftComplete`. L'appeler quand même rend un
  // refus sans code plutôt qu'un code détourné de son sens.
  if (!levelDraftComplete(draft)) return { ok: false, findings: [] };

  const findings = [
    ...checkName(draft.name, context.levelNames, 1, BUILDING_NAME_MAX),
  ];

  // N1.2 : « `ordinal` | entier | Unique par bâtiment, négatif admis pour les
  // sous-sols. » Deux niveaux de même rang rendraient l'ordre d'empilement
  // indéterminé, et c'est lui qui dit quel étage est au-dessus de quel autre.
  if (context.ordinals.includes(draft.ordinal ?? 0)) {
    findings.push(finding('DATA.LEVEL_ORDINAL_DUPLICATE', { ordinal: draft.ordinal ?? 0 }));
  }

  if (findings.length > 0) return { ok: false, findings };

  return {
    ok: true,
    value: {
      name: draft.name.trim(),
      ordinal: draft.ordinal ?? 0,
      // M1bis : « Altitude | numérique, mètres | requise, relative à
      // l'altitude de référence du site ». Aucune valeur par défaut : une
      // hauteur d'étage inventée déciderait de la longueur des liaisons
      // verticales, que M01.S6 veut calculée.
      elevationM: roundMetres(draft.elevationM ?? 0),
    },
    warnings: [],
  };
}

/** Le rang proposé pour un niveau ajouté : à la suite du plus élevé. */
export function nextOrdinal(ordinals: readonly number[]): number {
  return ordinals.length === 0 ? 0 : Math.max(...ordinals) + 1;
}

export type StructureWrite = {
  readonly orgId: string;
  readonly siteId: string;
  /** ISO-8601, fourni par l'appelant (E5.1). */
  readonly timestamp: string;
};

const COMMON = { module: '01-socle' as const };

/**
 * Crée un bâtiment, et son premier niveau.
 *
 * M1bis (partie M) : « Nouveau bâtiment | Crée un bâtiment, et un premier
 * niveau nommé par défaut ». Même raison qu'en M1 pour le site : un bâtiment sans niveau
 * est un état inutile que l'utilisateur devrait corriger lui-même.
 *
 * Les deux commandes portent le même groupe : c'est un geste, donc une
 * annulation (E5.2).
 */
export function buildingCommands(
  building: AcceptedBuilding,
  firstLevel: { readonly id: string; readonly name: string },
  ids: { readonly buildingId: string },
  write: StructureWrite,
): Outcome<readonly EntityCommand[]> {
  const group = `create-building:${ids.buildingId}`;
  const commands: EntityCommand[] = [];

  const built = buildCommand({
    ...COMMON,
    operation: 'create',
    table: 'building',
    id: ids.buildingId,
    org_id: write.orgId,
    timestamp: write.timestamp,
    groupKey: group,
    after: {
      id: ids.buildingId,
      org_id: write.orgId,
      site_id: write.siteId,
      name: building.name,
      independent_access: building.independentAccess,
      ...(building.defaultEdgeWidthM === null
        ? {}
        : { default_edge_width_m: String(building.defaultEdgeWidthM) }),
    },
  });
  if (!built.ok) return { ok: false, findings: built.findings };
  commands.push(built.value);

  const level = buildCommand({
    ...COMMON,
    operation: 'create',
    table: 'level',
    id: firstLevel.id,
    org_id: write.orgId,
    timestamp: write.timestamp,
    groupKey: group,
    after: {
      id: firstLevel.id,
      org_id: write.orgId,
      building_id: ids.buildingId,
      name: firstLevel.name,
      // Premier niveau du bâtiment : rang zéro, altitude de référence. Ce
      // n'est pas une valeur inventée mais le point d'origine vertical, le
      // même qu'en M1 (partie M) pour le premier niveau du site.
      ordinal: 0,
      elevation_m: '0',
    },
  });
  if (!level.ok) return { ok: false, findings: level.findings };
  commands.push(level.value);

  return { ok: true, value: commands, warnings: [] };
}

export function levelCommands(
  level: AcceptedLevel,
  ids: { readonly levelId: string; readonly buildingId: string },
  write: StructureWrite,
): Outcome<readonly EntityCommand[]> {
  const built = buildCommand({
    ...COMMON,
    operation: 'create',
    table: 'level',
    id: ids.levelId,
    org_id: write.orgId,
    timestamp: write.timestamp,
    groupKey: `create-level:${ids.levelId}`,
    after: {
      id: ids.levelId,
      org_id: write.orgId,
      building_id: ids.buildingId,
      name: level.name,
      ordinal: level.ordinal,
      elevation_m: String(level.elevationM),
    },
  });
  return built.ok
    ? { ok: true, value: [built.value], warnings: [] }
    : { ok: false, findings: built.findings };
}

/** Renomme un bâtiment ou un niveau. M1bis : « Renommer ». */
export function renameCommands(
  table: 'building' | 'level',
  id: string,
  before: string,
  after: string,
  existing: readonly string[],
  write: StructureWrite,
): Outcome<readonly EntityCommand[]> {
  const findings = checkName(after, existing, 1, BUILDING_NAME_MAX);
  if (findings.length > 0) return { ok: false, findings: [...findings] };

  const built = buildCommand({
    ...COMMON,
    operation: 'update',
    table,
    id,
    org_id: write.orgId,
    timestamp: write.timestamp,
    groupKey: `rename:${table}:${id}`,
    before: { name: before },
    after: { name: after.trim() },
  });
  return built.ok
    ? { ok: true, value: [built.value], warnings: [] }
    : { ok: false, findings: built.findings };
}

/**
 * Supprime un niveau, ou refuse.
 *
 * M1bis : « Refusé s'il porte des empreintes ou des nœuds,
 * `DATA.LEVEL_NOT_EMPTY`. » Le refus n'est pas un confort : supprimer un
 * niveau peuplé emporterait sa géométrie et son graphe par les clés
 * étrangères, sans que l'écran ait dit ce qu'il détruisait.
 *
 * `before` porte la ligne entière, sans quoi l'annulation ne pourrait pas la
 * rétablir (E5.1).
 */
export function deleteLevelCommands(
  level: { readonly id: string; readonly values: Readonly<Record<string, unknown>> },
  occupancy: { readonly footprints: number; readonly nodes: number },
  write: StructureWrite,
): Outcome<readonly EntityCommand[]> {
  if (occupancy.footprints > 0 || occupancy.nodes > 0) {
    return {
      ok: false,
      findings: [finding('DATA.LEVEL_NOT_EMPTY', {
        footprints: occupancy.footprints,
        nodes: occupancy.nodes,
      })],
    };
  }

  const built = buildCommand({
    ...COMMON,
    operation: 'delete',
    table: 'level',
    id: level.id,
    org_id: write.orgId,
    timestamp: write.timestamp,
    groupKey: `delete-level:${level.id}`,
    before: level.values as Record<string, string | number | boolean | null>,
  });
  return built.ok
    ? { ok: true, value: [built.value], warnings: [] }
    : { ok: false, findings: built.findings };
}
