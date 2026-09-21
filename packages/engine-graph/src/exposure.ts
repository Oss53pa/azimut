import type { Finding, Outcome } from '@azimut/core-model';
import { WEIGHT_SUM_TOLERANCE } from '@azimut/core-model';

/**
 * I5.3 — Exposure hypotheses.
 *
 * The exposure of a cell is derived from computed routes weighted by three
 * DECLARED factors: entry weights (share of footfall per access), attraction
 * weights (per motive destination), and a visibility cone (angle and distance
 * per circulation typology). A cell's exposure is a relative index within one
 * site, never a visitor count.
 *
 * Blocking rule (I5.3): a flow report cannot be produced without its
 * hypotheses. This guard enforces exactly that — the three declarations must be
 * present before any exposure is computed or exported. The exposure computation
 * itself (route enumeration and visibility, still provisional in I5.3) is not
 * implemented here.
 */
export type EntryWeight = {
  readonly access_id: string;
  /** Part de la fréquentation totale, en fraction de l'unité. */
  readonly weight: number;
};

/**
 * Total attendu des parts de fréquentation (N3.3).
 *
 * La fiche l'exprime en pour-cent — « somme des parts différente de 100 % » ;
 * les parts étant portées en fraction, le total vaut l'unité. C'est la même
 * règle, dans l'unité du modèle.
 */
export const ENTRY_WEIGHT_TOTAL = 1;

export type AttractionWeight = {
  readonly destination_id: string;
  readonly weight: number;
};

export type VisibilityCone = {
  readonly typology: string;
  readonly angle_deg: number;
  readonly distance_m: number;
};

export type ExposureHypotheses = {
  readonly entry_weights: readonly EntryWeight[];
  readonly attraction_weights: readonly AttractionWeight[];
  readonly visibility_cones: readonly VisibilityCone[];
};

function undeclared(factor: string): Finding {
  return {
    code: 'FLOW.WEIGHTS_UNDECLARED',
    severity: 'blocking',
    entity: null,
    params: { factor },
    ruleRef: 'I5.3',
  };
}

/** Somme des parts de fréquentation déclarées. */
export function entryWeightSum(weights: readonly EntryWeight[]): number {
  return weights.reduce((total, entry) => total + entry.weight, 0);
}

/**
 * Contrôle les hypothèses d'exposition.
 *
 * Deux refus, dans cet ordre :
 *
 * 1. P1 — les trois pondérations sont déclarées. Une anomalie
 *    `FLOW.WEIGHTS_UNDECLARED` par facteur manquant.
 * 2. N3.3 — les parts de fréquentation somment à l'unité. Une anomalie
 *    `FLOW.WEIGHTS_NOT_NORMALIZED` sinon.
 *
 * L'ordre n'est pas indifférent : un jeu vide somme à zéro, et le dire
 * « non normalisé » ferait chercher une erreur de saisie là où la déclaration
 * manque simplement. Le contrôle de normalisation ne s'exécute donc que sur
 * des parts déclarées.
 *
 * Seules les parts de fréquentation sont normalisées. Le pouvoir d'attraction
 * est une pondération relative, pas une part d'un tout, et un cône de
 * visibilité porte un angle et une distance : ni l'un ni l'autre ne somme à
 * quoi que ce soit. La fiche N3.3 ne l'exige pas davantage.
 */
export function guardExposureHypotheses(
  hypotheses: ExposureHypotheses,
): Outcome<null> {
  const findings: Finding[] = [];
  if (hypotheses.entry_weights.length === 0) findings.push(undeclared('entry_weights'));
  if (hypotheses.attraction_weights.length === 0) findings.push(undeclared('attraction_weights'));
  if (hypotheses.visibility_cones.length === 0) findings.push(undeclared('visibility_cones'));

  if (findings.length > 0) {
    return { ok: false, findings };
  }

  const sum = entryWeightSum(hypotheses.entry_weights);
  if (Math.abs(sum - ENTRY_WEIGHT_TOTAL) > WEIGHT_SUM_TOLERANCE) {
    return {
      ok: false,
      findings: [{
        code: 'FLOW.WEIGHTS_NOT_NORMALIZED',
        severity: 'blocking',
        entity: null,
        params: {
          factor: 'entry_weights',
          sum,
          expected: ENTRY_WEIGHT_TOTAL,
          count: hypotheses.entry_weights.length,
        },
        ruleRef: 'N3.3',
      }],
    };
  }

  return { ok: true, value: null, warnings: [] };
}

/**
 * H12 / I5.3 — a flow result can never be exported without its hypotheses. This
 * export guard raises a blocking FLOW.HYPOTHESIS_MISSING when the export bundle
 * carries no hypotheses at all, and otherwise defers to guardExposureHypotheses
 * so an attached-but-incomplete set of hypotheses still blocks the export.
 */
export function guardFlowResultExport(
  hypotheses: ExposureHypotheses | null,
): Outcome<null> {
  if (hypotheses === null) {
    return {
      ok: false,
      findings: [
        {
          code: 'FLOW.HYPOTHESIS_MISSING',
          severity: 'blocking',
          entity: null,
          params: {},
          ruleRef: 'H12',
        },
      ],
    };
  }
  return guardExposureHypotheses(hypotheses);
}
