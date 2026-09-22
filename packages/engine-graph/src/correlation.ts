import type { Finding, Outcome } from '@azimut/core-model';

/**
 * N3.2 / N3.3 — M03.P5 : un montant n'est calculé que si la corrélation entre
 * exposition et performance réelle atteint le seuil déclaré. En dessous, seuls
 * les écarts d'exposition sont produits, et l'interface le dit.
 *
 * Ce module ne calcule aucun montant. Il ne fait que la seule chose dont M03.P5
 * fait dépendre le montant : établir la corrélation, la comparer au seuil
 * déclaré, et refuser par `FLOW.CORRELATION_TOO_LOW` quand elle n'y atteint
 * pas. Le montant lui-même relève du module 09, qui n'appellera son calcul
 * qu'après avoir franchi ce garde-fou.
 *
 * La frontière de M03.P6 est portée par les types : l'indice d'exposition et
 * l'observation réelle sont deux enregistrements distincts, appariés ici par
 * destination. Azimut produit le premier et jamais le second.
 */

/** M03.P6 (partie N) — nature d'une donnée réelle importée. Aucune n'est produite par Azimut. */
export type PerformanceSourceKind =
  | 'footfall_count'
  | 'telemetry'
  | 'declared_revenue';

/**
 * M03.P6 (partie N) — observation réelle importée pour une cellule.
 *
 * `source_label` et `observed_at` ne sont pas facultatifs : M03.P6 exige que
 * l'origine et la date soient conservées, et une observation qui ne les porte
 * pas n'est pas une observation, c'est un nombre.
 */
export type PerformanceObservation = {
  readonly destination_id: string;
  /** Performance observée, dans l'unité de sa source. */
  readonly performance: number;
  readonly source_kind: PerformanceSourceKind;
  /** Qui l'a fournie : le système ou le tiers, jamais Azimut. */
  readonly source_label: string;
  /** Date de l'observation, ISO 8601. */
  readonly observed_at: string;
};

/** M03.P2 (partie N) / M03.P3 — indice d'exposition calculé par Azimut pour une cellule. */
export type ExposureIndex = {
  readonly destination_id: string;
  readonly index: number;
};

/**
 * M03.P5 (partie N) — hypothèse propre au chiffrage : le seuil de corrélation.
 *
 * Il est déclaré par celui qui commande l'audit, jamais porté par le code et
 * jamais doté d'une valeur par défaut. Un seuil implicite serait un seuil que
 * personne n'a assumé.
 */
export type MonetaryEstimateHypothesis = {
  /** Seuil déclaré, dans [0, 1]. */
  readonly min_correlation: number;
};

/**
 * Méthode de corrélation. Une seule, nommée dans le résultat pour qu'un
 * lecteur sache laquelle a produit le verdict.
 *
 * Le rang, et non la valeur : M03.P3 (partie N) fait de l'exposition « un indice relatif et
 * un rang, jamais une valeur absolue ». Corréler linéairement un indice
 * ordinal à un chiffre d'affaires supposerait à cet indice une échelle
 * d'intervalle que M03.P3 lui refuse. La corrélation des rangs de Spearman ne la
 * suppose pas.
 */
export type CorrelationMethod = 'spearman';

export type CorrelationStatus =
  /** Coefficient établi. */
  | 'established'
  /** Échantillon trop petit pour que le coefficient veuille dire quelque chose. */
  | 'too_few_pairs'
  /** Tous les rangs ex æquo d'un côté : le coefficient n'est pas défini. */
  | 'no_variance';

export type CorrelationAssessment = {
  readonly method: CorrelationMethod;
  /** Nombre de paires entrées dans le calcul. */
  readonly pairs: number;
  /** Observations écartées faute d'origine ou de date (M03.P6 (partie N)). */
  readonly dropped_unsourced: number;
  /** Coefficient dans [-1, 1], ou `null` quand il n'est pas établissable. */
  readonly coefficient: number | null;
  readonly status: CorrelationStatus;
};

/**
 * Nombre minimal de paires. Ce n'est pas un seuil métier, c'est le domaine de
 * définition : sur deux paires, la corrélation des rangs vaut toujours +1 ou
 * −1, et un seuil qu'un échantillon franchit par construction n'est pas un
 * seuil. Trois est le plus petit effectif où le coefficient peut prendre une
 * autre valeur.
 */
export const MIN_CORRELATION_PAIRS = 3;

/** Un seuil déclaré est un nombre fini de [0, 1]. Le reste n'est pas un seuil. */
export function isDeclaredThreshold(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

/** M03.P6 (partie N) — une observation sans origine ni date n'entre dans aucun calcul. */
export function isSourcedObservation(observation: PerformanceObservation): boolean {
  return observation.source_label.trim().length > 0
    && observation.observed_at.trim().length > 0;
}

type Pair = {
  readonly destination_id: string;
  readonly exposure: number;
  readonly performance: number;
};

/**
 * Apparie indices et observations par destination.
 *
 * Trié par identifiant de destination : l'ordre d'accumulation des sommes est
 * donc fixé, et deux appels sur les mêmes données rendent le même coefficient
 * au bit près (invariant 4). Une destination présente d'un seul côté n'entre
 * pas dans l'échantillon — il n'y a rien à corréler.
 */
function pairSample(
  indices: readonly ExposureIndex[],
  observations: readonly PerformanceObservation[],
): { readonly pairs: readonly Pair[]; readonly dropped: number } {
  const byDestination = new Map<string, number>();
  for (const index of indices) {
    if (!Number.isFinite(index.index)) continue;
    byDestination.set(index.destination_id, index.index);
  }

  const pairs: Pair[] = [];
  let dropped = 0;
  for (const observation of observations) {
    if (!isSourcedObservation(observation)) { dropped += 1; continue; }
    if (!Number.isFinite(observation.performance)) { dropped += 1; continue; }
    const exposure = byDestination.get(observation.destination_id);
    if (exposure === undefined) continue;
    pairs.push({
      destination_id: observation.destination_id,
      exposure,
      performance: observation.performance,
    });
  }

  pairs.sort((a, b) => a.destination_id.localeCompare(b.destination_id));
  return { pairs, dropped };
}

/**
 * Rangs d'une série, ex æquo à rang moyen.
 *
 * L'ordre est fixé par la valeur puis par l'identifiant : aucun résultat ne
 * dépend de la stabilité du tri de la plate-forme.
 */
function ranks(values: readonly { readonly key: string; readonly value: number }[]): Map<string, number> {
  const sorted = [...values].sort((a, b) =>
    a.value === b.value ? a.key.localeCompare(b.key) : a.value - b.value,
  );

  const result = new Map<string, number>();
  let start = 0;
  while (start < sorted.length) {
    let end = start;
    while (end + 1 < sorted.length && sorted[end + 1]?.value === sorted[start]?.value) end += 1;
    // Rangs 1-indexés ; un groupe d'ex æquo reçoit la moyenne de ses rangs.
    const averageRank = (start + end + 2) / 2;
    for (let i = start; i <= end; i += 1) {
      const entry = sorted[i];
      if (entry !== undefined) result.set(entry.key, averageRank);
    }
    start = end + 1;
  }
  return result;
}

/** Corrélation de Pearson sur deux séries de même longueur et de même ordre. */
function pearson(xs: readonly number[], ys: readonly number[]): number | null {
  const n = xs.length;
  if (n === 0) return null;

  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i += 1) {
    sumX += xs[i] ?? 0;
    sumY += ys[i] ?? 0;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let covariance = 0;
  let varianceX = 0;
  let varianceY = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = (xs[i] ?? 0) - meanX;
    const dy = (ys[i] ?? 0) - meanY;
    covariance += dx * dy;
    varianceX += dx * dx;
    varianceY += dy * dy;
  }

  if (varianceX === 0 || varianceY === 0) return null;
  return covariance / Math.sqrt(varianceX * varianceY);
}

/**
 * Établit la corrélation entre exposition et performance réelle.
 *
 * Mesure seulement : aucun verdict, aucun refus. C'est ce que l'interface
 * affiche pour dire où en est l'échantillon, y compris — et surtout — quand le
 * coefficient n'est pas établissable.
 */
export function assessCorrelation(
  indices: readonly ExposureIndex[],
  observations: readonly PerformanceObservation[],
): CorrelationAssessment {
  const { pairs, dropped } = pairSample(indices, observations);

  if (pairs.length < MIN_CORRELATION_PAIRS) {
    return {
      method: 'spearman',
      pairs: pairs.length,
      dropped_unsourced: dropped,
      coefficient: null,
      status: 'too_few_pairs',
    };
  }

  const exposureRanks = ranks(pairs.map(p => ({ key: p.destination_id, value: p.exposure })));
  const performanceRanks = ranks(pairs.map(p => ({ key: p.destination_id, value: p.performance })));

  const xs = pairs.map(p => exposureRanks.get(p.destination_id) ?? 0);
  const ys = pairs.map(p => performanceRanks.get(p.destination_id) ?? 0);
  const coefficient = pearson(xs, ys);

  if (coefficient === null) {
    return {
      method: 'spearman',
      pairs: pairs.length,
      dropped_unsourced: dropped,
      coefficient: null,
      status: 'no_variance',
    };
  }

  return {
    method: 'spearman',
    pairs: pairs.length,
    dropped_unsourced: dropped,
    coefficient,
    status: 'established',
  };
}

/**
 * M03.P5 (partie N) — garde-fou du montant.
 *
 * Refuse par `FLOW.CORRELATION_TOO_LOW` dans les trois cas où M03.P5 ne permet pas
 * de produire un montant : le coefficient est établi mais sous le seuil,
 * l'échantillon est trop petit, ou le coefficient n'est pas défini. Les deux
 * derniers ne sont pas « une corrélation basse » mais une corrélation non
 * établie ; `status` le dit dans le rapport, et un montant y est refusé de la
 * même façon — M03.P5 exige que la corrélation *atteigne* le seuil, et une
 * corrélation inconnue ne l'atteint pas.
 *
 * Un seuil qui n'est pas déclaré est refusé avant tout calcul, par
 * `FLOW.WEIGHTS_UNDECLARED` : la déclaration manque, et prétendre comparer à
 * un seuil absent serait rendre un verdict sur rien.
 *
 * L'appelant qui essuie un refus garde le rapport d'exposition : M03.P5 prévoit
 * que « seuls les écarts d'exposition sont produits ». Le refus porte sur le
 * montant, pas sur l'analyse.
 */
export function guardMonetaryEstimate(
  hypothesis: MonetaryEstimateHypothesis,
  indices: readonly ExposureIndex[],
  observations: readonly PerformanceObservation[],
): Outcome<CorrelationAssessment> {
  if (!isDeclaredThreshold(hypothesis.min_correlation)) {
    return {
      ok: false,
      findings: [{
        code: 'FLOW.WEIGHTS_UNDECLARED',
        severity: 'blocking',
        entity: null,
        params: { factor: 'min_correlation', declared: String(hypothesis.min_correlation) },
        ruleRef: 'N3.3',
      }],
    };
  }

  const assessment = assessCorrelation(indices, observations);
  if (assessment.coefficient === null
    || assessment.coefficient < hypothesis.min_correlation) {
    const finding: Finding = {
      code: 'FLOW.CORRELATION_TOO_LOW',
      severity: 'blocking',
      entity: null,
      params: {
        method: assessment.method,
        status: assessment.status,
        threshold: hypothesis.min_correlation,
        pairs: assessment.pairs,
        dropped_unsourced: assessment.dropped_unsourced,
        ...(assessment.coefficient !== null
          ? { correlation: assessment.coefficient }
          : {}),
      },
      ruleRef: 'N3.3',
    };
    return { ok: false, findings: [finding] };
  }

  return { ok: true, value: assessment, warnings: [] };
}
