/**
 * M2 (partie M) — « Valider le calage | Écrit `plan_calibration`, débloque le
 * tracé ».
 *
 * Le geste écrit deux lignes, parfois trois : le fond de plan, son calage, et
 * l'origine du site quand c'est le premier calage (M01.S1, partie N). Les trois
 * partent sous un même groupe, comme la création d'un site : un geste, une
 * annulation.
 *
 * M2 (partie M), critère d'acceptation 3, tel que A5.2 le borne : « Aucune
 * coordonnée **de géométrie du site** n'est écrite en pixels. Seuls les points
 * de calage de la source de plan le sont. » Ce qui est écrit du site est donc
 * en mètres ; ce qui est écrit de l'image — les points de la mesure — est en
 * pixels et le dit dans son nom. Un test le vérifie sur les commandes.
 */
import type { EntityCommand, Finding, Outcome, Point } from '@azimut/core-model';
import type { PlanPoint } from '../domain/plan-calibration.js';
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
  /**
   * A5.2 — les points de calage, dans l'ordre où l'opérateur les a posés, avec
   * l'identifiant tiré pour chacun. « Les points de calage permettent de
   * rejouer le calage à l'identique » : sans eux, la base garde l'échelle et
   * perd la mesure qui l'a produite.
   */
  readonly points: readonly { readonly id: string; readonly point: PlanPoint }[];
  /** A5.2 — la distance réelle saisie à l'étape 2 de M2 (partie M). */
  readonly referenceDistanceM: number;
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
      reference_distance_m: String(write.referenceDistanceM),
      rotation_deg: String(calibration.north_azimuth_deg),
      calibrated_at: write.timestamp,
    },
  });
  if (!calibrated.ok) return { ok: false, findings: calibrated.findings };

  const commands: EntityCommand[] = [source.value, calibrated.value];

  // A5.2 — les points de la mesure, en pixels de l'image. Seconde des deux
  // exceptions que M01.S2 admet : ils décrivent l'image, jamais le site.
  for (const [ordinal, entry] of write.points.entries()) {
    const stored = buildCommand({
      ...common,
      operation: 'create',
      table: 'plan_calibration_point',
      id: entry.id,
      after: {
        id: entry.id,
        org_id: write.orgId,
        calibration_id: write.calibrationId,
        ordinal,
        image_x_px: String(entry.point.x_px),
        image_y_px: String(entry.point.y_px),
      },
    });
    if (!stored.ok) return { ok: false, findings: stored.findings };
    commands.push(stored.value);
  }

  // M01.S1 (partie N) : le premier calage fixe le repère du site. Les suivants le
  // confirment, et n'écrivent donc rien — repasser la même valeur n'est pas
  // une modification, et `guardSiteOrigin` l'a déjà admise.
  if (siteOrigin(origin.site) === null) {
    const fixed = buildCommand({
      ...common,
      operation: 'update',
      table: 'site',
      id: write.siteId,
      before: { origin_x_m: null, origin_y_m: null },
      after: { origin_x_m: String(point.x_m), origin_y_m: String(point.y_m) },
    });
    if (!fixed.ok) return { ok: false, findings: fixed.findings };
    commands.push(fixed.value);
  }

  return { ok: true, value: commands, warnings: [] as Finding[] };
}
