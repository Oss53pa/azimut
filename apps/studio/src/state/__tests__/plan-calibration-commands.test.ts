import { describe, it, expect } from 'vitest';
import { calibrationCommands } from '../plan-calibration-commands.js';
import type { CalibrationWrite, OriginProposal } from '../plan-calibration-commands.js';
import { computeCalibration } from '../../domain/plan-calibration.js';
import type { AcceptedPlan } from '../plan-import.js';

const PLAN: AcceptedPlan = {
  format: 'pdf', mediaType: 'application/pdf', byteSize: 2048, page: 1,
};

const WRITE: CalibrationWrite = {
  orgId: 'aaaaaaaa-0000-0000-0000-000000000001',
  siteId: 'site-1',
  levelId: 'level-1',
  planSourceId: 'plan-1',
  calibrationId: 'calib-1',
  storagePath: 'plans/site-1/level-1/plan.pdf',
  timestamp: '2026-09-21T10:00:00.000Z',
};

const ORIGIN_FREE: OriginProposal = {
  site: {},
  proposed: { x_m: 12.5, y_m: -3.25 },
};

function calibration() {
  const r = computeCalibration({
    a: { x_px: 0, y_px: 0 },
    b: { x_px: 200, y_px: 0 },
    real_distance_m: 20,
    north_azimuth_deg: 12,
  });
  if (!r.ok) throw new Error('calage invalide');
  return r.value;
}

/**
 * M2 (partie M) — « Valider le calage | Écrit `plan_calibration`, débloque le
 * tracé ».
 */
describe('M2 (partie M) — écriture du calage', () => {
  it('écrit le fond, son calage, et fixe l’origine au premier calage', () => {
    const r = calibrationCommands(PLAN, calibration(), ORIGIN_FREE, WRITE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.map(c => c.table)).toEqual(['plan_source', 'plan_calibration', 'site']);
  });

  /**
   * M01.S1 (partie N) : « le repère est fixé par le premier calage ». Un second
   * calage le confirme sans le réécrire — repasser la même valeur n'est pas
   * une modification.
   */
  it('n’écrit plus le repère quand le site en a déjà un', () => {
    const r = calibrationCommands(PLAN, calibration(), {
      site: { origin_x_m: 12.5, origin_y_m: -3.25 },
      proposed: { x_m: 12.5, y_m: -3.25 },
    }, WRITE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.map(c => c.table)).toEqual(['plan_source', 'plan_calibration']);
  });

  it('refuse un calage qui déplacerait le repère du site', () => {
    const r = calibrationCommands(PLAN, calibration(), {
      site: { origin_x_m: 12.5, origin_y_m: -3.25 },
      proposed: { x_m: 99, y_m: 0 },
    }, WRITE);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.findings.map(f => f.code)).toContain('CALIB.ORIGIN_LOCKED');
  });

  /**
   * M2 (partie M), critère d'acceptation 3 — « Aucune coordonnée en pixels n'est écrite
   * en base. » Les pixels servent à mesurer, puis disparaissent.
   *
   * Une *coordonnée* en pixels, donc, et non toute mention du pixel :
   * `scale_m_per_px` est une échelle, le rapport entre les deux repères, et
   * c'est précisément ce qui permet de n'écrire que des mètres ailleurs. La
   * distinguer tient à ce contrôle : un `x_px` ou un `y_px` écrit en base
   * rendrait la modélisation dépendante de la résolution du fond.
   */
  it('n’écrit aucune coordonnée en pixels', () => {
    const r = calibrationCommands(PLAN, calibration(), ORIGIN_FREE, WRITE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const command of r.value) {
      for (const column of Object.keys(command.after ?? {})) {
        expect(column, `${command.table}.${column}`).not.toMatch(/(^|_)[xy]_px$/);
      }
    }
  });

  it('l’origine écrite est en mètres, celle du calage', () => {
    const r = calibrationCommands(PLAN, calibration(), ORIGIN_FREE, WRITE);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value[1]?.after?.['origin_x']).toBe('12.5');
      expect(r.value[1]?.after?.['origin_y']).toBe('-3.25');
    }
  });

  it('écrit une échelle en mètres par pixel, inverse de la résolution', () => {
    const measured = calibration();
    const r = calibrationCommands(PLAN, measured, ORIGIN_FREE, WRITE);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const scale = r.value[1]?.after?.['scale_m_per_px'];
      expect(Number(scale)).toBeCloseTo(1 / measured.resolution_px_per_m, 12);
    }
  });

  it('reporte l’azimut mesuré sur la rotation du fond', () => {
    const r = calibrationCommands(PLAN, calibration(), ORIGIN_FREE, WRITE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value[1]?.after?.['rotation_deg']).toBe('12');
  });

  /** Un geste, une annulation (E5.2). */
  it('groupe les commandes sous un même geste', () => {
    const r = calibrationCommands(PLAN, calibration(), ORIGIN_FREE, WRITE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(new Set(r.value.map(c => c.groupKey)).size).toBe(1);
  });

  it('n’écrit que des tables du module 01', () => {
    const r = calibrationCommands(PLAN, calibration(), ORIGIN_FREE, WRITE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.every(c => c.module === '01-socle')).toBe(true);
  });

  /**
   * M2 (partie M), critère d'acceptation 2 — « Le calage rejoué sur les mêmes points
   * donne exactement le même résultat. »
   */
  it('rejoué sur les mêmes points, donne exactement les mêmes commandes', () => {
    const a = calibrationCommands(PLAN, calibration(), ORIGIN_FREE, WRITE);
    const b = calibrationCommands(PLAN, calibration(), ORIGIN_FREE, WRITE);
    expect(a).toEqual(b);
  });
});
