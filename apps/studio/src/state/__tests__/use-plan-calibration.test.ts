import { describe, it, expect } from 'vitest';
import { stepOf, blockingReason, EMPTY_DRAFT, CALIBRATION_STEPS } from '../use-plan-calibration.js';
import type { CalibrationDraft } from '../use-plan-calibration.js';

const PLAN = { format: 'pdf', mediaType: 'application/pdf', byteSize: 1, page: 1 } as const;

function draft(over: Partial<CalibrationDraft> = {}): CalibrationDraft {
  return { ...EMPTY_DRAFT, ...over };
}

/**
 * M2 (partie M) — trois étapes : le fond, l'échelle, l'orientation.
 *
 * L'étape se déduit de ce qui est saisi. Deux sources pour le même fait
 * finissent toujours par diverger, et l'utilisateur qui revient en arrière
 * verrait l'écran dire le contraire de ce qu'il voit.
 */
describe('M2 (partie M) — avancement du calage', () => {
  it('les trois étapes sont celles de M2 (partie M)', () => {
    expect([...CALIBRATION_STEPS]).toEqual(['plan', 'scale', 'orientation']);
  });

  it('commence au fond de plan', () => {
    expect(stepOf(draft())).toBe('plan');
  });

  it('passe à l’échelle une fois le fond accepté', () => {
    expect(stepOf(draft({ plan: PLAN }))).toBe('scale');
  });

  it('reste à l’échelle tant qu’un point manque', () => {
    expect(stepOf(draft({ plan: PLAN, a: { x_px: 0, y_px: 0 }, realDistanceM: 10 }))).toBe('scale');
  });

  it('reste à l’échelle tant que la distance n’est pas saisie', () => {
    expect(stepOf(draft({
      plan: PLAN, a: { x_px: 0, y_px: 0 }, b: { x_px: 90, y_px: 0 },
    }))).toBe('scale');
  });

  it('passe à l’orientation quand l’échelle est complète', () => {
    expect(stepOf(draft({
      plan: PLAN, a: { x_px: 0, y_px: 0 }, b: { x_px: 90, y_px: 0 }, realDistanceM: 9,
    }))).toBe('orientation');
  });
});

/**
 * M2 (partie M), état « Partiel » — « Fond chargé, calage incomplet : le tracé reste
 * inaccessible et l'écran dit pourquoi. »
 */
describe('M2 (partie M) — ce qui bloque le tracé, et pourquoi', () => {
  const complete = draft({
    plan: PLAN, a: { x_px: 0, y_px: 0 }, b: { x_px: 90, y_px: 0 },
    realDistanceM: 9, northAzimuthDeg: 0,
  });

  it('un calage complet ne bloque rien', () => {
    expect(blockingReason(complete)).toBeNull();
  });

  it('nomme l’étape qui manque, plutôt que de dire « incomplet »', () => {
    expect(blockingReason(draft())).toBe('plan');
    expect(blockingReason(draft({ plan: PLAN }))).toBe('scale');
    expect(blockingReason({ ...complete, northAzimuthDeg: null })).toBe('orientation');
  });

  /**
   * Un azimut de 0 est le nord franc (D1.3) : le confondre avec une absence
   * bloquerait un calage parfaitement valide.
   */
  it('ne confond pas le nord franc avec une orientation absente', () => {
    expect(blockingReason({ ...complete, northAzimuthDeg: 0 })).toBeNull();
  });
});
