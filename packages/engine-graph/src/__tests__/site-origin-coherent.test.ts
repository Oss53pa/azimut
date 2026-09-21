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
    origin_x: calibration.origin_x,
    origin_y: calibration.origin_y,
    rotation_deg: calibration.rotation_deg,
  };
}

function mismatches(site: SiteData): readonly Finding[] {
  const result = runChecks(site);
  const findings = result.ok ? result.value.findings : result.findings;
  return findings.filter(f => f.code === CODE);
}

/**
 * S1 — « Le repère site est fixé au premier calage et n'est jamais modifié. »
 *
 * `guardSiteOrigin` refuse l'écriture ; ce contrôle constate l'état enregistré,
 * ce que `calibrated_at` rend possible.
 */
describe('S1 — repère site cohérent avec le premier calage', () => {
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

  it('signale un repère déplacé', () => {
    const site: SiteData = {
      ...refMultilevel,
      site: { ...refMultilevel.site, origin_x: 0, origin_y: 0 },
    };
    const found = mismatches(site);
    expect(found).toHaveLength(1);
    expect(found[0]?.severity).toBe('blocking');
    expect(found[0]?.ruleRef).toBe('N1.3');
    expect(found[0]?.entity).toEqual({ kind: 'site', id: refMultilevel.site.id });
    expect(found[0]?.params['status']).toBe('origin_differs');
    expect(found[0]?.params['first_calibration_id']).toBe('cal-ml-rdc');
    expect(found[0]?.params['first_x']).toBe(-12.5);
    expect(found[0]?.params['site_x']).toBe(0);
  });

  it('signale un repère recopié du mauvais calage', () => {
    // L'origine du R+1, qui n'est pas le premier calage.
    const site: SiteData = {
      ...refMultilevel,
      site: { ...refMultilevel.site, origin_x: -12.5, origin_y: -9.25 },
    };
    expect(mismatches(site)).toHaveLength(1);
  });

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
      site: { ...refMultilevel.site, origin_x: 999, origin_y: 999 },
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
