import { describe, it, expect } from 'vitest';
import { runChecks } from '../run-checks.js';
import { refAdversarial, refBroken, refMinimal, refMultilevel } from '@azimut/testkit';
import type { Finding, PlanCalibration, SiteData } from '@azimut/core-model';

const CODE = 'CALIB.ORIGIN_MISMATCH';

/** Le site de référence, privé de son repère : les deux clés sont absentes. */
function siteWithoutOrigin(): SiteData['site'] {
  const { site } = refMultilevel;
  return {
    id: site.id,
    org_id: site.org_id,
    name: site.name,
    country_code: site.country_code,
    timezone: site.timezone,
    rules_pack_id: site.rules_pack_id,
    active_langs: site.active_langs,
    ...(site.reference_elevation_m !== undefined
      ? { reference_elevation_m: site.reference_elevation_m }
      : {}),
  };
}

/** Un calage privé de sa date : la clé est absente, pas à `undefined`. */
function undate(calibration: PlanCalibration): PlanCalibration {
  return {
    id: calibration.id,
    org_id: calibration.org_id,
    plan_source_id: calibration.plan_source_id,
    scale_m_per_px: calibration.scale_m_per_px,
    rotation_deg: calibration.rotation_deg,
  };
}

function mismatches(site: SiteData): readonly Finding[] {
  const result = runChecks(site);
  const findings = result.ok ? result.value.findings : result.findings;
  return findings.filter(f => f.code === CODE);
}

/**
 * M01.S1 — « Le repère site est fixé au premier calage et n'est jamais modifié. »
 *
 * `guardSiteOrigin` refuse l'écriture ; ce contrôle constate l'état enregistré,
 * ce que `calibrated_at` rend possible.
 */
describe('M01.S1 — repère site cohérent avec le premier calage', () => {
  it('ne signale rien sur les sites cohérents', () => {
    expect(mismatches(refMinimal)).toHaveLength(0);
    expect(mismatches(refMultilevel)).toHaveLength(0);
    expect(mismatches(refAdversarial)).toHaveLength(0);
  });

  it('ne signale rien sur un site sans aucun calage', () => {
    // Ses niveaux sont déjà tous signalés par CALIB.LEVEL_NOT_CALIBRATED ;
    // ajouter une anomalie de repère ne dirait rien de plus.
    expect(mismatches(refBroken)).toHaveLength(0);
  });

  /**
   * Le contrôle signalait aussi un repère déplacé, en comparant l'origine du
   * site à celle du premier calage. La migration 0032 a aligné
   * `plan_calibration` sur A5.2 : le calage porte une position en pixels de
   * l'image, et non plus une origine en mètres. Les deux grandeurs ne sont
   * plus comparables, et A5 ne dit pas comment elles se correspondent. Les
   * deux essais qui l'éprouvaient sont retirés avec la moitié de contrôle
   * qu'ils couvraient, plutôt que réécrits sur une correspondance devinée.
   *
   * Ce qui reste est le cas que rien d'autre ne dirait : un premier calage a
   * eu lieu et le site n'a pas de repère.
   */
  it('signale un premier calage sans repère enregistré', () => {
    // Site reconstruit sans les deux clés plutôt qu'avec des clés à
    // `undefined` : `exactOptionalPropertyTypes` distingue les deux, et c'est
    // l'absence qu'on veut éprouver.
    const site: SiteData = { ...refMultilevel, site: siteWithoutOrigin() };
    const found = mismatches(site);
    expect(found).toHaveLength(1);
    expect(found[0]?.params['status']).toBe('origin_absent');
    expect(found[0]?.params['first_calibration_id']).toBe('cal-ml-rdc');
  });

  it('se tait quand un calage n’a pas de date', () => {
    // Le premier calage n'est pas déterminable : faire dépendre une anomalie
    // bloquante d'une donnée manquante désignerait un coupable au hasard.
    const site: SiteData = {
      ...refMultilevel,
      site: { ...refMultilevel.site, origin_x_m: 999, origin_y_m: 999 },
      plan_calibrations: refMultilevel.plan_calibrations.map(undate),
    };
    expect(mismatches(site)).toHaveLength(0);
  });

  it('déclare le contrôle dans checks_run', () => {
    const result = runChecks(refMinimal);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.checks_run).toContain('site_origin_coherent');
  });
});
