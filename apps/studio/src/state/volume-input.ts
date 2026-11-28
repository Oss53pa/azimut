/**
 * T-1.3 — le volume d'une empreinte : altitude de base, hauteur, matière.
 *
 * « Un volume sans hauteur est refusé. Les valeurs par défaut proviennent du
 * niveau, jamais d'une constante. » Décision d'Oss53pa du 28 novembre 2026 :
 *  · l'altitude de base par défaut est celle du niveau, que la géométrie lit
 *    (critère 4 de l'écran des niveaux) ;
 *  · la hauteur par défaut est l'écart au niveau suivant du même bâtiment. Le
 *    dernier niveau n'en a pas : la hauteur s'y saisit, et rien n'est supposé ;
 *  · la matière vient d'une liste fermée en donnée, et se choisit toujours :
 *    aucune n'est présélectionnée, « non précisée » en fait partie.
 *
 * Rien ici ne lit l'écran ni la base : l'écran appelle, la base revalide.
 */
import type { ColumnValue, EntityCommand, Finding, Level, Outcome } from '@azimut/core-model';
import { buildCommand, notice, quantizePosition } from '@azimut/core-model';
import type { FormNotice, FormOutcome } from '@azimut/core-model';

export type VolumeDefaults = {
  readonly base_elevation_m: number;
  /** Nulle sur le dernier niveau du bâtiment : la hauteur s'y saisit. */
  readonly height_m: number | null;
};

/** Les valeurs par défaut d'un volume posé sur ce niveau, ou `null` si le niveau est inconnu. */
export function volumeDefaults(levels: readonly Level[], levelId: string): VolumeDefaults | null {
  const level = levels.find(l => l.id === levelId);
  if (level === undefined) return null;
  const above = levels
    .filter(l => l.building_id === level.building_id && l.ordinal > level.ordinal)
    .sort((a, b) => a.ordinal - b.ordinal)[0];
  const gap = above === undefined ? null : quantizePosition(above.elevation_m - level.elevation_m);
  return {
    base_elevation_m: level.elevation_m,
    // Un niveau suivant posé à la même altitude, ou plus bas, ne dit pas de
    // hauteur : la saisir vaut mieux qu'en déduire une nulle ou négative.
    height_m: gap !== null && gap > 0 ? gap : null,
  };
}

export type VolumeDraft = {
  readonly footprintId: string;
  readonly base_elevation_m: number | null;
  readonly height_m: number | null;
  /** Vide tant qu'aucune matière n'est choisie. */
  readonly material_key: string;
};

export type AcceptedVolume = {
  readonly footprintId: string;
  readonly base_elevation_m: number;
  readonly height_m: number;
  readonly material_key: string;
};

/**
 * Accepte ou refuse un volume. Les refus sont réunis : l'opérateur corrige
 * tout d'un coup, au lieu de les découvrir un par un.
 */
export function acceptVolume(draft: VolumeDraft, materials: readonly string[]): FormOutcome<AcceptedVolume> {
  const findings: Finding[] = [];
  const notices: FormNotice[] = [];
  if (draft.height_m === null || !Number.isFinite(draft.height_m) || draft.height_m <= 0) {
    findings.push({
      code: 'GEOM.VOLUME_NO_HEIGHT', severity: 'blocking',
      entity: { kind: 'footprint', id: draft.footprintId }, params: {}, ruleRef: null,
    });
  }
  if (draft.base_elevation_m === null || !Number.isFinite(draft.base_elevation_m)) {
    notices.push(notice('form.volume.base.required'));
  }
  if (!materials.includes(draft.material_key)) notices.push(notice('form.volume.material.required'));
  if (findings.length > 0 || notices.length > 0 || draft.height_m === null || draft.base_elevation_m === null) {
    return { ok: false, findings, notices };
  }
  return {
    ok: true,
    value: {
      footprintId: draft.footprintId,
      base_elevation_m: quantizePosition(draft.base_elevation_m),
      height_m: quantizePosition(draft.height_m),
      material_key: draft.material_key,
    },
    warnings: [],
    notices: [],
  };
}

export type VolumeWrite = {
  readonly orgId: string;
  /** ISO-8601, fourni par l'appelant (E5.1). */
  readonly timestamp: string;
  /** L'identifiant du volume à créer, tiré par l'appelant. */
  readonly newId: string;
};

/** Le volume que l'empreinte porte déjà, tel que la session le tient. */
export type ExistingVolume = {
  readonly id: string;
  readonly values: Readonly<Record<string, unknown>>;
};

/** Une valeur de la session, telle qu'une commande peut la transporter. */
function column(values: Readonly<Record<string, unknown>>, key: string): ColumnValue {
  const value = values[key];
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : null;
}

/**
 * La commande d'un volume : une création si l'empreinte n'en porte pas, une
 * modification de ses trois colonnes sinon. Un seul geste, une seule
 * annulation.
 */
export function volumeCommand(
  volume: AcceptedVolume,
  existing: ExistingVolume | null,
  write: VolumeWrite,
): Outcome<EntityCommand> {
  const columns = {
    base_elevation_m: volume.base_elevation_m,
    height_m: volume.height_m,
    material_key: volume.material_key,
  };
  if (existing === null) {
    return buildCommand({
      operation: 'create', module: '01-socle', table: 'volume', id: write.newId, org_id: write.orgId,
      after: { id: write.newId, org_id: write.orgId, footprint_id: volume.footprintId, ...columns },
      timestamp: write.timestamp, groupKey: `volume:${write.newId}`,
    });
  }
  const before = {
    base_elevation_m: column(existing.values, 'base_elevation_m'),
    height_m: column(existing.values, 'height_m'),
    material_key: column(existing.values, 'material_key'),
  };
  return buildCommand({
    operation: 'update', module: '01-socle', table: 'volume', id: existing.id, org_id: write.orgId,
    before, after: columns, timestamp: write.timestamp, groupKey: `volume:${existing.id}`,
  });
}
