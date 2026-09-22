import { describe, it, expect } from 'vitest';
import { runChecks } from '../run-checks.js';
import { refAdversarial, refBroken, refMinimal, refMultilevel } from '@azimut/testkit';
import { calibratedLevelIds, isUsableScale } from '@azimut/core-model';
import type { Finding, PlanCalibration, PlanSource, SiteData } from '@azimut/core-model';

const CODE = 'CALIB.LEVEL_NOT_CALIBRATED';

function findingsOf(site: SiteData): readonly Finding[] {
  const result = runChecks(site);
  return result.ok ? result.value.findings : result.findings;
}

function notCalibrated(site: SiteData): readonly Finding[] {
  return findingsOf(site).filter(f => f.code === CODE);
}

function source(id: string, levelId: string): PlanSource {
  return {
    id,
    org_id: 'org-test-001',
    level_id: levelId,
    storage_path: `plans/${id}.png`,
    media_type: 'image/png',
    uploaded_at: '2026-01-05T09:00:00.000Z',
  };
}

function calibration(id: string, sourceId: string, scale: number): PlanCalibration {
  return {
    id,
    org_id: 'org-test-001',
    plan_source_id: sourceId,
    scale_m_per_px: scale,
    rotation_deg: 0,
  };
}

/**
 * N1.4 — « Niveau sans plan calé », bloquant.
 *
 * Le critère N1.7-3 demande que le cas soit détecté sur un site de référence
 * dédié et ne le soit pas sur le site voisin : `ref-broken` porte les deux
 * situations, les trois autres sites sont calés.
 */
describe('N1.4 — un niveau sans plan calé est bloquant', () => {
  it('signale les deux niveaux de ref-broken, ni plus ni moins', () => {
    const found = notCalibrated(refBroken);
    expect(found.map(f => f.entity?.id)).toEqual(['lvl-brk-r1', 'lvl-brk-rdc']);
  });

  it('distingue le fond non calé du fond absent par plan_source_count', () => {
    const found = notCalibrated(refBroken);
    const byLevel = new Map(found.map(f => [f.entity?.id, f]));
    // Un fond importé, jamais calé : il reste à caler.
    expect(byLevel.get('lvl-brk-rdc')?.params['plan_source_count']).toBe(1);
    // Aucun fond importé : il reste à importer.
    expect(byLevel.get('lvl-brk-r1')?.params['plan_source_count']).toBe(0);
  });

  it('porte la gravité, l’entité et la règle attendues', () => {
    for (const finding of notCalibrated(refBroken)) {
      expect(finding.severity).toBe('blocking');
      expect(finding.entity?.kind).toBe('level');
      expect(finding.ruleRef).toBe('N1.4');
      expect(finding.params['building_id']).toBe('bldg-brk-001');
    }
  });

  it('ne signale rien sur les sites dont les niveaux sont calés', () => {
    expect(notCalibrated(refMinimal)).toHaveLength(0);
    expect(notCalibrated(refMultilevel)).toHaveLength(0);
    expect(notCalibrated(refAdversarial)).toHaveLength(0);
  });

  it('déclare le contrôle dans checks_run', () => {
    const result = runChecks(refMinimal);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.checks_run).toContain('level_calibrated');
  });

  it('rend le même verdict deux fois de suite (invariant 4)', () => {
    expect(notCalibrated(refBroken)).toEqual(notCalibrated(refBroken));
  });
});

describe('N1.4 — ce qui vaut, ou non, pour un calage', () => {
  it('ne tient pas un niveau pour calé par le calage du fond d’un autre niveau', () => {
    // Le calage existe, mais il porte sur le fond de `lvl-brk-rdc`. Il ne peut
    // pas caler `lvl-brk-r1`, qui n'a aucun fond.
    const site: SiteData = {
      ...refBroken,
      plan_calibrations: [calibration('cal-brk-rdc', 'ps-brk-rdc', 0.05)],
    };
    expect(notCalibrated(site).map(f => f.entity?.id)).toEqual(['lvl-brk-r1']);
  });

  it('refuse une échelle nulle, négative ou non finie comme calage', () => {
    for (const scale of [0, -0.05, Number.NaN, Number.POSITIVE_INFINITY]) {
      const site: SiteData = {
        ...refMinimal,
        plan_calibrations: [calibration('cal-min-001', 'ps-min-001', scale)],
      };
      expect(notCalibrated(site).map(f => f.entity?.id)).toEqual(['lvl-001']);
    }
  });

  it('tient un niveau pour calé dès qu’un seul de ses fonds l’est', () => {
    const site: SiteData = {
      ...refMinimal,
      plan_sources: [...refMinimal.plan_sources, source('ps-min-002', 'lvl-001')],
    };
    expect(notCalibrated(site)).toHaveLength(0);
  });

  it('ne signale aucun niveau sur un site qui n’en a pas', () => {
    const site: SiteData = { ...refMinimal, levels: [] };
    expect(notCalibrated(site)).toHaveLength(0);
  });
});

describe('calibratedLevelIds', () => {
  it('ne retient que les niveaux dont un fond porte une échelle exploitable', () => {
    const sources = [source('ps-a', 'lvl-a'), source('ps-b', 'lvl-b')];
    const calibrations = [
      calibration('cal-a', 'ps-a', 0.05),
      calibration('cal-b', 'ps-b', 0),
    ];
    const ids = calibratedLevelIds(sources, calibrations);
    expect([...ids]).toEqual(['lvl-a']);
  });

  it('ignore un calage qui ne désigne aucun fond connu', () => {
    const ids = calibratedLevelIds(
      [source('ps-a', 'lvl-a')],
      [calibration('cal-orphan', 'ps-absent', 0.05)],
    );
    expect(ids.size).toBe(0);
  });
});

describe('isUsableScale', () => {
  it('accepte une échelle strictement positive et finie', () => {
    expect(isUsableScale(0.05)).toBe(true);
    expect(isUsableScale(1)).toBe(true);
  });

  it('refuse zéro, le négatif et le non fini', () => {
    expect(isUsableScale(0)).toBe(false);
    expect(isUsableScale(-1)).toBe(false);
    expect(isUsableScale(Number.NaN)).toBe(false);
    expect(isUsableScale(Number.POSITIVE_INFINITY)).toBe(false);
  });
});
