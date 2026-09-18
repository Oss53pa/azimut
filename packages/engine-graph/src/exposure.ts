import type { Finding, Outcome } from '@azimut/core-model';
import { SHARE_SUM_TOLERANCE } from '@azimut/core-model';

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
  readonly weight: number;
};

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

/**
 * Le tout que les parts décomposent.
 *
 * I5.3 appelle les deux pondérations des « parts de fréquentation » : une part
 * est une fraction d'un tout, et le tout vaut un. La convention n'est pas
 * inventée ici — l'écran des parcours clients déclarait déjà `1 / nombre
 * d'accès` pour les poids d'entrée ; la fixer rend seulement lisible ce qui
 * s'y pratiquait sans être dit.
 *
 * Ce n'est pas une valeur d'origine normative : aucune norme ne décide qu'une
 * part vaut une fraction de l'unité, c'est ce que le mot veut dire.
 */
const SHARE_TOTAL = 1;

function undeclared(factor: string): Finding {
  return {
    code: 'FLOW.WEIGHTS_UNDECLARED',
    severity: 'blocking',
    entity: null,
    params: { factor },
    ruleRef: 'I5.3',
  };
}

function notNormalized(factor: string, total: number): Finding {
  return {
    code: 'FLOW.WEIGHTS_NOT_NORMALIZED',
    severity: 'blocking',
    entity: null,
    params: { factor, total, expected: SHARE_TOTAL },
    ruleRef: 'I5.3',
  };
}

/**
 * Un jeu de parts déclaré, mais qui ne décompose pas le tout.
 *
 * Distinct de l'absence de déclaration, et la nuance porte : un jeu vide est
 * une hypothèse qu'on n'a pas posée, un jeu qui somme à trois est une
 * hypothèse fausse. Les confondre laisserait croire qu'on a vérifié la
 * seconde en vérifiant la première — c'est précisément ce qui se passait,
 * `FLOW.WEIGHTS_NOT_NORMALIZED` figurant au catalogue sans qu'aucun moteur ne
 * le lève. Un jeu vide ne repasse donc pas ici : il est déjà rapporté.
 */
function normalizationFinding(
  factor: string,
  weights: readonly { readonly weight: number }[],
): Finding | null {
  if (weights.length === 0) return null;
  const total = weights.reduce((sum, w) => sum + w.weight, 0);
  if (Math.abs(total - SHARE_TOTAL) <= SHARE_SUM_TOLERANCE) return null;
  return notNormalized(factor, total);
}

/**
 * Guard that the three exposure weightings are declared, and that the two
 * share families decompose the whole. Returns one blocking finding per missing
 * factor and one per family whose shares do not sum to `SHARE_TOTAL`, in a
 * stable order; ok when all three are present and both families are
 * normalized. The visibility cone is not a share — an angle and a distance —
 * and is therefore only checked for presence.
 */
export function guardExposureHypotheses(
  hypotheses: ExposureHypotheses,
): Outcome<null> {
  const findings: Finding[] = [];
  if (hypotheses.entry_weights.length === 0) findings.push(undeclared('entry_weights'));
  if (hypotheses.attraction_weights.length === 0) findings.push(undeclared('attraction_weights'));
  if (hypotheses.visibility_cones.length === 0) findings.push(undeclared('visibility_cones'));

  const entryShares = normalizationFinding('entry_weights', hypotheses.entry_weights);
  if (entryShares !== null) findings.push(entryShares);
  const attractionShares = normalizationFinding('attraction_weights', hypotheses.attraction_weights);
  if (attractionShares !== null) findings.push(attractionShares);

  if (findings.length > 0) {
    return { ok: false, findings };
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
