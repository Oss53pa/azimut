import type { Point } from './geometry.js';
import type { Outcome } from './outcome.js';

/**
 * A5.2 — fond de plan et calage.
 *
 * Un niveau peut porter un ou plusieurs fonds de plan importés
 * (`plan_source`) ; chacun est calé au plus une fois (`plan_calibration`).
 * Le calage est ce qui rend un fond exploitable : sans lui, une position lue
 * sur l'image ne se convertit en mètres par aucun moyen, et toute empreinte
 * relevée dessus est fausse sans que rien ne le signale. D'où la règle N1.4 :
 * un niveau sans plan calé est une anomalie bloquante.
 *
 * M01.S2 et D1.1 tiennent sans exception : aucune coordonnée en pixels n'est
 * stockée, ici pas davantage qu'ailleurs. Un calage porte une échelle — un
 * rapport, pas une coordonnée —, un angle, et l'origine du fond exprimée en
 * mètres du repère site. La conversion s'écrit
 * `site = origine + rotation · (pixel × échelle)` : chaque terme stocké y est
 * métrique ou sans dimension, et le pixel n'entre que par l'entrée.
 */

/** Fond de plan importé pour un niveau. Un fichier, pas une géométrie. */
export type PlanSource = {
  readonly id: string;
  readonly org_id: string;
  readonly level_id: string;
  readonly storage_path: string;
  readonly media_type: string;
  /** Horodatage ISO 8601 de l'import. */
  readonly uploaded_at: string;
};

/**
 * Calage d'un fond de plan : ce qui transforme un pixel en mètre.
 *
 * `scale_m_per_px` est l'échelle du fond, en mètres réels par pixel — l'inverse
 * de la résolution manipulée à la saisie (écran M2 de la tranche M,
 * `resolution_px_per_m`). Les deux
 * représentent la même mesure ; A5.2 fixe celle qui est stockée.
 *
 * `origin_x_px` / `origin_y_px` situent, **dans l'image**, l'origine du repère
 * site (A5.2). Les deux colonnes ont remplacé une origine en mètres à la
 * migration 0032 : la base ne garde plus de coordonnée métier tirée du fond.
 *
 * Elles sont facultatives, et c'est un point ouvert plutôt qu'un choix : aucun
 * écran ne désigne le point de l'image qui porte l'origine du repère. A5.2 ne
 * dit pas non plus comment `site.origin_x_m` et ces deux colonnes se
 * correspondent — l'une est un point du repère site, l'autre sa position dans
 * une image, et le lien demande une décision de modèle que A5 ne prend pas.
 * Elles restent donc non écrites, et `guardSiteOrigin` continue de tenir
 * M01.S1 sur la seule ligne `site`.
 *
 * `calibrated_at` date l'opération de calage, et non l'import du fond que date
 * `plan_source.uploaded_at`. C'est lui qui rend « le premier calage » de M01.S1
 * identifiable : sans lui, la règle est écrite mais invérifiable. Facultatif
 * parce qu'une ligne enregistrée avant qu'il existe n'a pas de date, et qu'en
 * inventer une ferait passer une inconnue pour un fait.
 *
 * Un fond porte un calage et pas deux : la base le garantit par un index
 * unique sur `plan_source_id` (migration 0023). Deux calages du même fond
 * donneraient deux conversions pixel → mètre pour la même image, sans que rien
 * ne dise laquelle s'applique.
 *
 * Conséquence sur `calibrated_at`, et c'est un contrat que l'écriture devra
 * tenir : recaler un fond (M01.S9) met cette ligne à jour et **ne touche pas** à
 * `calibrated_at`, qui reste la date d'établissement du calage. Le faire suivre
 * la mise à jour déplacerait « le premier calage » à chaque recalage, et
 * `checkSiteOriginCoherent` finirait par comparer le repère du site à l'origine
 * d'un autre fond — donc à lever une anomalie bloquante contre un site correct.
 */
export type PlanCalibration = {
  readonly id: string;
  readonly org_id: string;
  readonly plan_source_id: string;
  readonly scale_m_per_px: number;
  /**
   * A5.2 — position, dans l'image, de l'origine du repère site. Absente tant
   * que rien ne la désigne : voir la note ci-dessus.
   */
  readonly origin_x_px?: number;
  readonly origin_y_px?: number;
  /** A5.2 — distance réelle dont l'échelle est tirée, étape 2 de M2 (partie M). */
  readonly reference_distance_m?: number;
  readonly rotation_deg: number;
  /** Horodatage ISO 8601 du calage. */
  readonly calibrated_at?: string;
};

/**
 * Premier calage d'un site, ou `null` quand il n'est pas déterminable.
 *
 * Déterminable veut dire : il y a au moins un calage, et tous portent une date
 * lisible. Un seul calage sans date suffit à rendre la réponse inconnue — il
 * pourrait être le plus ancien, et rien ne permet de l'écarter. Répondre quand
 * même, en ne classant que les datés, désignerait un premier calage qui n'en
 * est peut-être pas un, et c'est sur lui que M01.S1 est vérifiée.
 *
 * À dates égales, l'identifiant tranche : deux exécutions rendent le même
 * calage (invariant 4). Une égalité ne devrait pas se produire entre deux
 * calages d'un même site, chacun étant une opération distincte ; elle n'est
 * départagée que pour que la réponse ne dépende pas de l'ordre des lignes.
 */
export function firstCalibration(
  calibrations: readonly PlanCalibration[],
): PlanCalibration | null {
  if (calibrations.length === 0) return null;

  const dated: { readonly calibration: PlanCalibration; readonly at: number }[] = [];
  for (const calibration of calibrations) {
    const at = calibration.calibrated_at === undefined
      ? Number.NaN
      : Date.parse(calibration.calibrated_at);
    if (Number.isNaN(at)) return null;
    dated.push({ calibration, at });
  }

  dated.sort((a, b) => (
    a.at === b.at
      ? a.calibration.id.localeCompare(b.calibration.id)
      : a.at - b.at
  ));
  return dated[0]?.calibration ?? null;
}

/**
 * Vrai quand l'échelle stockée permet réellement une conversion.
 *
 * Ce n'est pas un seuil : zéro, un nombre négatif et `NaN` ne sont pas des
 * échelles trop petites, ce sont des absences d'échelle. Une ligne de calage
 * qui en porte une ne cale rien, et la laisser passer pour un calage ferait
 * taire le contrôle N1.4 au lieu de le déclencher.
 */
export function isUsableScale(scale_m_per_px: number): boolean {
  return Number.isFinite(scale_m_per_px) && scale_m_per_px > 0;
}

/**
 * Identifiants des niveaux effectivement calés : ceux qui portent au moins un
 * fond de plan lui-même calé par une échelle exploitable.
 *
 * Fonction pure, sans tri ni ordre de sortie significatif — l'ordre des
 * anomalies est fixé par l'appelant, sur les niveaux et non sur cet ensemble.
 */
export function calibratedLevelIds(
  planSources: readonly PlanSource[],
  planCalibrations: readonly PlanCalibration[],
): ReadonlySet<string> {
  const calibratedSourceIds = new Set<string>();
  for (const calibration of planCalibrations) {
    if (!isUsableScale(calibration.scale_m_per_px)) continue;
    calibratedSourceIds.add(calibration.plan_source_id);
  }

  const levelIds = new Set<string>();
  for (const source of planSources) {
    if (!calibratedSourceIds.has(source.id)) continue;
    levelIds.add(source.level_id);
  }
  return levelIds;
}

/**
 * M01.S1 / D1.1 — le repère site.
 *
 * Son origine est celle du premier calage du site : les deux nombres que porte
 * ce calage sont recopiés sur la ligne `site`, en mètres, et n'y sont plus
 * jamais modifiés. Les modifier déplacerait le repère sous toute la géométrie
 * déjà saisie — chaque empreinte, chaque nœud, chaque support garderait ses
 * coordonnées en désignant un autre endroit du monde. Aucune migration ne
 * rattraperait cela, puisque rien n'enregistre de quel repère chaque valeur
 * provenait.
 *
 * Tant qu'aucun calage n'a eu lieu, l'origine est absente. C'est l'état d'un
 * site dont le repère n'est pas encore posé, et non un repère à l'origine (0, 0)
 * — les deux se lisent autrement et le premier interdit de tracer.
 */
export type SiteOriginBearer = {
  readonly origin_x_m?: number;
  readonly origin_y_m?: number;
};

/**
 * Origine du repère site, ou `null` si elle n'est pas posée.
 *
 * Un seul endroit apparie les deux colonnes, et une origine à moitié saisie
 * n'est pas une origine : elle se lit comme absente, jamais comme un point
 * dont une coordonnée vaudrait zéro par défaut.
 */
export function siteOrigin(site: SiteOriginBearer): Point | null {
  const { origin_x_m, origin_y_m } = site;
  if (origin_x_m === undefined || origin_y_m === undefined) return null;
  if (!Number.isFinite(origin_x_m) || !Number.isFinite(origin_y_m)) return null;
  return { x_m: origin_x_m, y_m: origin_y_m };
}

/**
 * M01.S1 — garde-fou du repère site.
 *
 * Accepte de poser l'origine quand le site n'en a pas : c'est le premier
 * calage, et c'est lui qui fixe le repère. Refuse toute valeur différente
 * ensuite, par `CALIB.ORIGIN_LOCKED`. Repasser la même valeur n'est pas une
 * modification et ne refuse rien — un second calage du même fond, ou le calage
 * d'un autre niveau sur le même repère, doit pouvoir aboutir.
 *
 * La comparaison est exacte, sans tolérance : l'origine n'est pas mesurée à
 * nouveau à chaque calage, elle est recopiée. Deux valeurs qui diffèrent d'un
 * millième de millimètre viennent de deux mesures différentes, donc de deux
 * repères différents.
 *
 * Un seul objet ici, la règle M01.S1. Le point reçu est celui d'un calage que
 * `computeCalibration` a déjà accepté ; valider la mesure une seconde fois
 * demanderait un code que le catalogue n'a pas et dédoublerait un contrôle qui
 * a son écran. Une valeur stockée illisible est de toute façon neutralisée à
 * la lecture : `siteOrigin` la rend absente.
 */
export function guardSiteOrigin(
  site: SiteOriginBearer,
  requested: Point,
): Outcome<Point> {
  const current = siteOrigin(site);

  if (current !== null
    && (current.x_m !== requested.x_m || current.y_m !== requested.y_m)) {
    return {
      ok: false,
      findings: [{
        code: 'CALIB.ORIGIN_LOCKED',
        severity: 'blocking',
        entity: null,
        params: {
          current_x: current.x_m,
          current_y: current.y_m,
          requested_x: requested.x_m,
          requested_y: requested.y_m,
        },
        ruleRef: 'N1.3',
      }],
    };
  }

  return { ok: true, value: requested, warnings: [] };
}
