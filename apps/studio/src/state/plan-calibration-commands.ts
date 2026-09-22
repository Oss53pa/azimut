/**
 * M2 (partie M) — « Valider le calage | Écrit `plan_calibration`, débloque le
 * tracé ».
 *
 * Le geste écrit deux lignes, parfois trois : le fond de plan, son calage, et
 * l'origine du site quand c'est le premier calage (M01.S1, partie N). Les trois
 * partent sous un même groupe, comme la création d'un site : un geste, une
 * annulation.
 *
 * M2 (partie M), critère d'acceptation 3 : « Aucune coordonnée en pixels n'est écrite en
 * base. » Les pixels servent à mesurer, puis disparaissent : ce qui est écrit
 * est une échelle en mètres par pixel et une origine en mètres. Un test le
 * vérifie sur les commandes elles-mêmes.
 */
import type { EntityCommand, Finding, Outcome, Point } from '@azimut/core-model';
import { buildCommand, guardSiteOrigin, siteOrigin } from '@azimut/core-model';
import type { SiteOriginBearer } from '@azimut/core-model';
import type { Calibration } from '../domain/plan-calibration.js';
import type { AcceptedPlan } from './plan-import.js';

export type CalibrationWrite = {
  readonly orgId: string;
  readonly siteId: string;
  readonly levelId: string;
  /** Identifiants tirés par l'appelant : un calcul ne tire pas au sort. */
  readonly planSourceId: string;
  readonly calibrationId: string;
  /** Chemin de l'artefact téléversé, hors de la base. */
  readonly storagePath: string;
  /** ISO-8601, fourni par l'appelant (E5.1). */
  readonly timestamp: string;
};

/**
 * L'origine du repère site que ce calage pose ou confirme.
 *
 * M01.S1 : le repère est fixé par le premier calage et ne bouge plus. L'origine
 * est donc celle du site quand il en a déjà une, et celle du calage sinon.
 */
export type OriginProposal = {
  readonly site: SiteOriginBearer;
  readonly proposed: Point;
};

export function calibrationCommands(
  plan: AcceptedPlan,
  calibration: Calibration,
  origin: OriginProposal,
  write: CalibrationWrite,
): Outcome<readonly EntityCommand[]> {
  const guarded = guardSiteOrigin(origin.site, origin.proposed);
  if (!guarded.ok) return { ok: false, findings: guarded.findings };

  const group = `calibrate:${write.planSourceId}`;
  const common = {
    module: '01-socle' as const,
    org_id: write.orgId,
    timestamp: write.timestamp,
    groupKey: group,
  };
  const point = guarded.value;

  const source = buildCommand({
    ...common,
    operation: 'create',
    table: 'plan_source',
    id: write.planSourceId,
    after: {
      id: write.planSourceId,
      org_id: write.orgId,
      level_id: write.levelId,
      storage_path: write.storagePath,
      media_type: plan.mediaType,
    },
  });
  if (!source.ok) return { ok: false, findings: source.findings };

  const calibrated = buildCommand({
    ...common,
    operation: 'create',
    table: 'plan_calibration',
    id: write.calibrationId,
    after: {
      id: write.calibrationId,
      org_id: write.orgId,
      plan_source_id: write.planSourceId,
      // Mètres par pixel : l'inverse de la résolution mesurée. C'est la seule
      // trace de la mesure, et ce n'est pas une coordonnée en pixels.
      scale_m_per_px: String(1 / calibration.resolution_px_per_m),
      origin_x: String(point.x_m),
      origin_y: String(point.y_m),
      rotation_deg: String(calibration.north_azimuth_deg),
      calibrated_at: write.timestamp,
    },
  });
  if (!calibrated.ok) return { ok: false, findings: calibrated.findings };

  const commands: EntityCommand[] = [source.value, calibrated.value];

  // M01.S1 (partie N) : le premier calage fixe le repère du site. Les suivants le
  // confirment, et n'écrivent donc rien — repasser la même valeur n'est pas
  // une modification, et `guardSiteOrigin` l'a déjà admise.
  if (siteOrigin(origin.site) === null) {
    const fixed = buildCommand({
      ...common,
      operation: 'update',
      table: 'site',
      id: write.siteId,
      before: { origin_x: null, origin_y: null },
      after: { origin_x: String(point.x_m), origin_y: String(point.y_m) },
    });
    if (!fixed.ok) return { ok: false, findings: fixed.findings };
    commands.push(fixed.value);
  }

  return { ok: true, value: commands, warnings: [] as Finding[] };
}
