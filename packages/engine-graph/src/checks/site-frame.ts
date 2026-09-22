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
 * n'était pas identifiable et la règle, bien qu'opposable, restait
 * invérifiable.
 *
 * Le contrôle comparait l'origine du site à celle du premier calage. La
 * migration 0032 a aligné `plan_calibration` sur A5.2 : le calage porte
 * désormais une position en pixels de l'image, et non plus une origine en
 * mètres. Les deux grandeurs ne sont plus comparables, et A5 ne dit pas
 * comment elles se correspondent. La moitié du contrôle qui reposait sur
 * cette comparaison — `origin_differs` — est donc retirée plutôt que
 * devinée, et le point est porté au rapport selon A2.2.
 *
 * Ce qui reste, et qui suffit à ce que rien ne passe en silence :
 * `origin_absent`, le premier calage a eu lieu et le site n'a pas de repère.
 * Rien d'autre ne le dirait — les niveaux étant calés,
 * `CALIB.LEVEL_NOT_CALIBRATED` se tait.
 *
 * Le contrôle ne dit rien quand le premier calage n'est pas déterminable, à
 * savoir quand un calage au moins n'a pas de date : désigner un premier calage
 * au hasard des lignes datées ferait dépendre une anomalie bloquante d'une
 * donnée manquante. Un site sans aucun calage ne dit rien non plus, ses
 * niveaux étant déjà tous signalés.
 */
export function checkSiteOriginCoherent(site: SiteData): Finding[] {
  const first = firstCalibration(site.plan_calibrations);
  if (first === null) return [];

  if (siteOrigin(site.site) !== null) return [];

  return [{
    code: 'CALIB.ORIGIN_MISMATCH',
    severity: 'blocking',
    entity: { kind: 'site', id: site.site.id },
    params: {
      status: 'origin_absent',
      first_calibration_id: first.id,
    },
    ruleRef: 'N1.3',
  }];
}
