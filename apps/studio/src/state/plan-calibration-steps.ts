/**
 * F15, `state/` — l'avancement du calage de M2 (partie M).
 *
 * M2 se parcourt en trois étapes : le fond, l'échelle, l'orientation. Ce module
 * dit où en est la saisie et ce qui lui manque, et rien d'autre.
 *
 * Il tenait aussi un crochet React qui pilotait l'écran avec sa propre pile
 * d'annulation. Ce crochet est parti : `useTrancheSession` tient désormais une
 * session partagée par les quatre écrans de l'atelier, et une pile privée à un
 * écran aurait perdu l'annulation au changement d'écran — ce que E5.2 refuse,
 * la portée de la pile étant « le site en cours d'édition ». Rien ne
 * l'appelait, et aucun essai ne le couvrait.
 */
import type { AcceptedPlan } from './plan-import.js';
import type { PlanPoint } from '../domain/plan-calibration.js';

/** Les trois étapes de M2 (partie M), dans l'ordre. */
export const CALIBRATION_STEPS = ['plan', 'scale', 'orientation'] as const;
export type CalibrationStep = (typeof CALIBRATION_STEPS)[number];

export type CalibrationDraft = {
  readonly plan: AcceptedPlan | null;
  readonly a: PlanPoint | null;
  readonly b: PlanPoint | null;
  readonly realDistanceM: number;
  readonly northAzimuthDeg: number | null;
};

export const EMPTY_DRAFT: CalibrationDraft = {
  plan: null,
  a: null,
  b: null,
  realDistanceM: 0,
  northAzimuthDeg: null,
};

/**
 * L'étape où en est la saisie.
 *
 * Elle se déduit de ce qui est saisi, elle n'est pas rangée à part : deux
 * sources pour le même fait finissent toujours par diverger, et l'utilisateur
 * qui revient en arrière verrait l'écran dire le contraire de ce qu'il voit.
 */
export function stepOf(draft: CalibrationDraft): CalibrationStep {
  if (draft.plan === null) return 'plan';
  if (draft.a === null || draft.b === null || draft.realDistanceM <= 0) return 'scale';
  return 'orientation';
}

/**
 * M2 (partie M), état « Partiel » : « Fond chargé, calage incomplet : le tracé reste
 * inaccessible et l'écran dit pourquoi. » C'est cette fonction qui dit
 * pourquoi, plutôt qu'un message écrit dans l'écran.
 */
export function blockingReason(draft: CalibrationDraft): CalibrationStep | null {
  const step = stepOf(draft);
  return step === 'orientation' && draft.northAzimuthDeg !== null ? null : step;
}
