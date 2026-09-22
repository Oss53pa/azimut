import type { SiteData, Finding } from '@azimut/core-model';
import { calibratedLevelIds, firstCalibration, siteOrigin } from '@azimut/core-model';

/**
 * N1.4 — un niveau sans plan calé est une anomalie bloquante.
 *
 * Un niveau est calé quand il porte au moins un fond de plan lui-même calé
 * (`calibratedLevelIds`). Deux situations distinctes tombent sous le même
 * code, comme le veut la partie N, et `plan_source_count` les sépare dans le
 * rapport : aucun fond importé du tout, ou un fond importé que personne n'a
 * calé. La conduite à tenir n'est pas la même — importer, ou caler.
 *
 * Le contrôle porte sur le niveau et non sur l'empreinte : un niveau vide mais
 * non calé est déjà en faute, parce que la première empreinte qu'on y tracera
 * le sera sur un fond muet.
 */
export function checkLevelCalibrated(site: SiteData): Finding[] {
  const calibrated = calibratedLevelIds(site.plan_sources, site.plan_calibrations);

  const sourceCount = new Map<string, number>();
  for (const source of site.plan_sources) {
    sourceCount.set(source.level_id, (sourceCount.get(source.level_id) ?? 0) + 1);
  }

  const findings: Finding[] = [];
  const sorted = [...site.levels].sort((a, b) => a.id.localeCompare(b.id));
  for (const level of sorted) {
    if (calibrated.has(level.id)) continue;
    findings.push({
      code: 'CALIB.LEVEL_NOT_CALIBRATED',
      severity: 'blocking',
      entity: { kind: 'level', id: level.id },
      params: {
        building_id: level.building_id,
        plan_source_count: sourceCount.get(level.id) ?? 0,
      },
      ruleRef: 'N1.4',
    });
  }
  return findings;
}

/**
 * M01.S1 — le repère site est celui du premier calage.
 *
 * `calibrated_at` rend ce contrôle possible : sans lui, « le premier calage »
 * n'était pas identifiable et la règle, bien qu'opposable, restait invérifiable.
 *
 * Deux incohérences, séparées par `status` :
 *  - `origin_differs` : le site porte une origine, et ce n'est pas celle du
 *    premier calage. Quelqu'un a déplacé le repère, ou l'a recopié du mauvais
 *    calage ; dans les deux cas la géométrie déjà saisie ne désigne plus ce
 *    qu'elle désignait.
 *  - `origin_absent` : le premier calage a eu lieu et le site n'a pas de
 *    repère. Rien d'autre ne le dirait — les niveaux étant calés,
 *    `CALIB.LEVEL_NOT_CALIBRATED` se tait.
 *
 * Le contrôle ne dit rien quand le premier calage n'est pas déterminable, c'est
 * à dire quand un calage au moins n'a pas de date : désigner un premier calage
 * au hasard des lignes datées ferait dépendre une anomalie bloquante d'une
 * donnée manquante. Un site sans aucun calage ne dit rien non plus, ses niveaux
 * étant déjà tous signalés.
 */
export function checkSiteOriginCoherent(site: SiteData): Finding[] {
  const first = firstCalibration(site.plan_calibrations);
  if (first === null) return [];

  const origin = siteOrigin(site.site);
  if (origin === null) {
    return [{
      code: 'CALIB.ORIGIN_MISMATCH',
      severity: 'blocking',
      entity: { kind: 'site', id: site.site.id },
      params: {
        status: 'origin_absent',
        first_calibration_id: first.id,
        first_x: first.origin_x,
        first_y: first.origin_y,
      },
      ruleRef: 'N1.3',
    }];
  }

  if (origin.x_m === first.origin_x && origin.y_m === first.origin_y) return [];

  return [{
    code: 'CALIB.ORIGIN_MISMATCH',
    severity: 'blocking',
    entity: { kind: 'site', id: site.site.id },
    params: {
      status: 'origin_differs',
      first_calibration_id: first.id,
      first_x: first.origin_x,
      first_y: first.origin_y,
      site_x: origin.x_m,
      site_y: origin.y_m,
    },
    ruleRef: 'N1.3',
  }];
}
