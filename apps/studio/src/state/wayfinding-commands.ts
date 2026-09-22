/**
 * Chemin d'écriture du module 02, première partie : zonage, nommage,
 * hiérarchie de l'information, jalonnement.
 *
 * R1 et R2 (partie L) : seul le module propriétaire écrit ses tables.
 * `buildCommand` le refuse autrement, et c'est ce refus qui rend la propriété opposable
 * plutôt que documentaire.
 *
 * Le tableau des messages a son propre module, `message-schedule-commands`,
 * parce qu'il s'écrit en un seul geste — un tableau et ses lignes — là où les
 * quatre entités d'ici s'écrivent une par une.
 */
import type { EntityCommand, Finding, Outcome } from '@azimut/core-model';
import { buildCommand } from '@azimut/core-model';

const MODULE = '02-wayfinding';

export type WayfindingWrite = {
  readonly orgId: string;
  readonly siteId: string;
  /** ISO-8601, fourni par l'appelant (E5.1, jamais lu ici). */
  readonly timestamp: string;
};

/** N2.2 — les cinq natures de zone d'orientation. */
export const ZONE_KINDS = ['mall', 'entrance', 'core', 'service', 'outdoor'] as const;
export type ZoneKind = (typeof ZONE_KINDS)[number];

/** N2.2 — les cibles d'une règle de nommage, et ses portées d'unicité. */
export const NAMING_TARGETS = ['level', 'zone', 'door', 'core', 'parking'] as const;
export type NamingTarget = (typeof NAMING_TARGETS)[number];

export const UNIQUENESS_SCOPES = ['site', 'building', 'level'] as const;
export type UniquenessScope = (typeof UNIQUENESS_SCOPES)[number];

export type OrientationZoneDraft = {
  readonly id: string;
  readonly code: string;
  readonly nameFr: string;
  readonly nameEn: string;
  readonly kind: ZoneKind;
  readonly footprintIds: readonly string[];
};

export type NamingRuleDraft = {
  readonly id: string;
  readonly target: NamingTarget;
  readonly pattern: string;
  readonly maxLength: number;
  readonly uniquenessScope: UniquenessScope;
};

export type InformationLevelDraft = {
  readonly id: string;
  readonly typologyId: string;
  readonly level: number;
};

export type SequenceStepDraft = {
  readonly id: string;
  readonly profileId: string;
  readonly ordinal: number;
  readonly nodeId: string;
  readonly expectedLevel: number;
};

/**
 * Un refus de commande, sous le seul code que le catalogue offre pour cela.
 *
 * D2.2 : « Toute anomalie produite par un moteur figure dans ce catalogue.
 * Ajouter un code demande une entrée ici dans le même commit. » Le catalogue
 * est dans le cahier des charges ; il n'appartient pas au code de s'en donner
 * de nouveaux. Une valeur hors domaine se refuse donc sous
 * `EDIT.COMMAND_SHAPE_INVALID`, dont les paramètres nomment le champ fautif,
 * plutôt que sous un code inventé pour l'occasion.
 *
 * Les bornes elles-mêmes restent garanties par les contraintes de la base :
 * ce refus-ci les rend lisibles avant l'aller-retour, il ne les remplace pas.
 */
function shapeRefusal(
  field: string,
  params: Record<string, string | number>,
  id: string,
): Finding {
  return {
    code: 'EDIT.COMMAND_SHAPE_INVALID',
    severity: 'blocking',
    entity: { kind: 'command', id },
    params: { field, ...params },
    ruleRef: null,
  };
}

function nameRequired(params: Record<string, string | number>, id: string): Finding {
  return {
    code: 'DATA.NAME_REQUIRED',
    severity: 'blocking',
    entity: { kind: 'command', id },
    params,
    ruleRef: null,
  };
}

/**
 * Le code d'une zone, tel que N2.2 le borne : un à huit caractères.
 *
 * La contrainte existe aussi en base. La poser ici aussi n'est pas une
 * redondance : elle rend le refus lisible avant l'aller-retour, et la base
 * reste ce qui le garantit.
 */
const ZONE_CODE_MAX = 8;

export function createOrientationZone(
  draft: OrientationZoneDraft,
  write: WayfindingWrite,
): Outcome<readonly EntityCommand[]> {
  const findings: Finding[] = [];
  const code = draft.code.trim();

  if (code === '' || code.length > ZONE_CODE_MAX) {
    findings.push(shapeRefusal('code', { code: draft.code, max: ZONE_CODE_MAX }, draft.id));
  }
  // N2.2 : « Requis dans chaque langue active. » Une zone sans nom anglais
  // produirait une colonne vide au tableau des messages, sans rien signaler.
  if (draft.nameFr.trim() === '' || draft.nameEn.trim() === '') {
    findings.push(nameRequired({ fr: draft.nameFr, en: draft.nameEn }, draft.id));
  }
  if (findings.length > 0) return { ok: false, findings };

  return single({
    table: 'orientation_zone',
    id: draft.id,
    write,
    after: {
      site_id: write.siteId,
      code,
      name_fr: draft.nameFr.trim(),
      name_en: draft.nameEn.trim(),
      kind: draft.kind,
      footprint_ids: JSON.stringify(draft.footprintIds),
    },
  });
}

export function createNamingRule(
  draft: NamingRuleDraft,
  write: WayfindingWrite,
): Outcome<readonly EntityCommand[]> {
  if (draft.maxLength <= 0) {
    return {
      ok: false,
      findings: [shapeRefusal('max_length', { max_length: draft.maxLength }, draft.id)],
    };
  }
  if (draft.pattern.trim() === '') {
    return {
      ok: false,
      findings: [shapeRefusal('pattern', { target: draft.target }, draft.id)],
    };
  }

  return single({
    table: 'naming_rule',
    id: draft.id,
    write,
    after: {
      site_id: write.siteId,
      target: draft.target,
      pattern: draft.pattern.trim(),
      max_length: draft.maxLength,
      uniqueness_scope: draft.uniquenessScope,
    },
  });
}

/**
 * W3 — « Tout support porte au moins un niveau d'information. »
 *
 * Le rattachement se fait typologie par typologie. L'absence de rattachement
 * n'est pas refusée ici, puisqu'il n'y a rien à écrire : c'est l'audit du
 * module qui lève `WAYFIND.NO_INFORMATION_LEVEL` sur le support concerné.
 */
export function createInformationLevel(
  draft: InformationLevelDraft,
  write: WayfindingWrite,
): Outcome<readonly EntityCommand[]> {
  if (!Number.isInteger(draft.level) || draft.level < 1 || draft.level > 4) {
    return {
      ok: false,
      findings: [shapeRefusal('level', { level: draft.level }, draft.id)],
    };
  }
  return single({
    table: 'information_level',
    id: draft.id,
    write,
    after: { typology_id: draft.typologyId, level: draft.level },
  });
}

/**
 * H2.4 — une étape du plan de jalonnement.
 *
 * `ordinal` est l'ordre de rencontre le long du parcours. Deux étapes de même
 * rang pour un même profil sont refusées en base ; ici on refuse seulement ce
 * qui n'a pas de sens en soi, un rang négatif.
 */
export function createSequenceStep(
  draft: SequenceStepDraft,
  write: WayfindingWrite,
): Outcome<readonly EntityCommand[]> {
  const findings: Finding[] = [];
  if (!Number.isInteger(draft.ordinal) || draft.ordinal < 0) {
    findings.push(shapeRefusal('ordinal', { ordinal: draft.ordinal }, draft.id));
  }
  if (!Number.isInteger(draft.expectedLevel)
    || draft.expectedLevel < 1 || draft.expectedLevel > 4) {
    findings.push(shapeRefusal('expected_level', { level: draft.expectedLevel }, draft.id));
  }
  if (findings.length > 0) return { ok: false, findings };

  return single({
    table: 'wayfinding_sequence',
    id: draft.id,
    write,
    after: {
      site_id: write.siteId,
      profile_id: draft.profileId,
      ordinal: draft.ordinal,
      node_id: draft.nodeId,
      expected_level: draft.expectedLevel,
    },
  });
}

/** Une création, enveloppée une fois pour les quatre entités. */
function single(input: {
  readonly table: string;
  readonly id: string;
  readonly write: WayfindingWrite;
  readonly after: Readonly<Record<string, string | number | boolean | null>>;
}): Outcome<readonly EntityCommand[]> {
  const built = buildCommand({
    operation: 'create',
    module: MODULE,
    table: input.table,
    id: input.id,
    org_id: input.write.orgId,
    after: { id: input.id, org_id: input.write.orgId, ...input.after },
    timestamp: input.write.timestamp,
  });
  return built.ok ? { ok: true, value: [built.value], warnings: [] } : built;
}

/**
 * A5.6 et N2.2 — le code lisible d'un support, par exemple `D-042`.
 *
 * `code` est une colonne de `support`, et `support` est la seule table que L0
 * scinde : son implantation revient au module 02, sa fabrication au module 04.
 * La commande ne touche donc qu'une colonne, et `buildCommand` refuse toute
 * autre part de la ligne.
 *
 * L'unicité par site est tenue par la base — index unique posé par la
 * migration 0027. Elle ne peut pas l'être ici : ce fichier est pur, il ne lit
 * rien, et un contrôle en mémoire laisserait passer le cas qui compte, deux
 * postes attribuant le même code au même instant.
 */
export type SupportCodeDraft = {
  readonly supportId: string;
  /** Le code en place, tel que la ligne le porte. `null` s'il n'y en a pas. */
  readonly previousCode: string | null;
  readonly code: string;
};

export function setSupportCode(
  draft: SupportCodeDraft,
  write: WayfindingWrite,
): Outcome<readonly EntityCommand[]> {
  const code = draft.code.trim();
  if (code === '') {
    return {
      ok: false,
      findings: [shapeRefusal('code', { support_id: draft.supportId }, draft.supportId)],
    };
  }

  const built = buildCommand({
    operation: 'update',
    module: MODULE,
    table: 'support',
    id: draft.supportId,
    org_id: write.orgId,
    before: { code: draft.previousCode },
    after: { code },
    timestamp: write.timestamp,
  });
  return built.ok ? { ok: true, value: [built.value], warnings: [] } : built;
}
