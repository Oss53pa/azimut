/**
 * F15, `state/` — le magasin de l'écran M2 (partie M).
 *
 * M2 (partie M) se parcourt en trois étapes : le fond, l'échelle, l'orientation. Le
 * magasin tient l'avancement, appelle les contrôles de chaque étape, et
 * n'écrit qu'au bout — « Valider le calage | Écrit `plan_calibration`,
 * débloque le tracé ».
 */
import { useCallback, useMemo, useState } from 'react';
import type { Finding } from '@azimut/core-model';
import { EMPTY_STORE, dispatch } from './command-store.js';
import type { CommandSink, StoreState } from './command-store.js';
import { acceptPlanFile } from './plan-import.js';
import type { AcceptedPlan, PlanFile } from './plan-import.js';
import { calibrationCommands } from './plan-calibration-commands.js';
import type { CalibrationWrite, OriginProposal } from './plan-calibration-commands.js';
import { computeCalibration } from '../domain/plan-calibration.js';
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

export type CalibrationState = {
  readonly draft: CalibrationDraft;
  readonly findings: readonly Finding[];
  readonly warnings: readonly Finding[];
  readonly busy: boolean;
  /** Vrai une fois le calage écrit : le tracé est débloqué. */
  readonly calibrated: boolean;
};

export const IDLE_CALIBRATION: CalibrationState = {
  draft: EMPTY_DRAFT,
  findings: [],
  warnings: [],
  busy: false,
  calibrated: false,
};

export type CalibrationEnvironment = {
  readonly write: Omit<CalibrationWrite, 'planSourceId' | 'calibrationId' | 'timestamp'>;
  readonly origin: OriginProposal;
  readonly newId: () => string;
  readonly now: () => string;
};

export function usePlanCalibration(
  sink: CommandSink,
  environment: CalibrationEnvironment,
): {
  readonly state: CalibrationState;
  readonly store: StoreState;
  readonly step: CalibrationStep;
  readonly acceptFile: (file: PlanFile) => void;
  readonly setPoints: (a: PlanPoint | null, b: PlanPoint | null) => void;
  readonly setDistance: (metres: number) => void;
  readonly setAzimuth: (degrees: number | null) => void;
  readonly recalibrate: () => void;
  readonly validate: () => Promise<void>;
} {
  const [state, setState] = useState<CalibrationState>(IDLE_CALIBRATION);
  const [store, setStore] = useState<StoreState>(EMPTY_STORE);
  const step = useMemo(() => stepOf(state.draft), [state.draft]);

  const acceptFile = useCallback((file: PlanFile) => {
    const outcome = acceptPlanFile(file);
    setState(previous => outcome.ok
      ? { ...previous, findings: [], draft: { ...previous.draft, plan: outcome.value } }
      // M7.5 (partie M) : le refus garde le reste de la saisie en l'état.
      : { ...previous, findings: outcome.findings });
  }, []);

  const patch = useCallback((change: Partial<CalibrationDraft>) => {
    setState(previous => ({
      ...previous,
      findings: [],
      draft: { ...previous.draft, ...change },
    }));
  }, []);

  const setPoints = useCallback((a: PlanPoint | null, b: PlanPoint | null) => {
    patch({ a, b });
  }, [patch]);

  const setDistance = useCallback((metres: number) => { patch({ realDistanceM: metres }); }, [patch]);
  const setAzimuth = useCallback((degrees: number | null) => { patch({ northAzimuthDeg: degrees }); }, [patch]);

  /** M2 (partie M) : « Recaler | Reprend à l'étape 2, conserve le fond ». */
  const recalibrate = useCallback(() => {
    setState(previous => ({
      ...IDLE_CALIBRATION,
      draft: { ...EMPTY_DRAFT, plan: previous.draft.plan },
    }));
  }, []);

  const validate = useCallback(async () => {
    const { draft } = state;
    if (draft.plan === null) return;

    setState(previous => ({ ...previous, busy: true, findings: [] }));

    const measured = computeCalibration({
      a: draft.a,
      b: draft.b,
      real_distance_m: draft.realDistanceM,
      north_azimuth_deg: draft.northAzimuthDeg,
    });
    if (!measured.ok) {
      setState(previous => ({ ...previous, busy: false, findings: measured.findings }));
      return;
    }

    const commands = calibrationCommands(draft.plan, measured.value, environment.origin, {
      ...environment.write,
      planSourceId: environment.newId(),
      calibrationId: environment.newId(),
      points: [
        ...(draft.a !== null ? [{ id: environment.newId(), point: draft.a }] : []),
        ...(draft.b !== null ? [{ id: environment.newId(), point: draft.b }] : []),
      ],
      referenceDistanceM: draft.realDistanceM,
      timestamp: environment.now(),
    });
    if (!commands.ok) {
      setState(previous => ({ ...previous, busy: false, findings: commands.findings }));
      return;
    }

    const written = await dispatch(store, sink, commands.value);
    setStore(written.state);
    setState(previous => ({
      ...previous,
      busy: false,
      findings: written.outcome.ok ? [] : written.outcome.findings,
      warnings: measured.warnings,
      calibrated: written.outcome.ok,
    }));
  }, [environment, sink, state, store]);

  return { state, store, step, acceptFile, setPoints, setDistance, setAzimuth, recalibrate, validate };
}
