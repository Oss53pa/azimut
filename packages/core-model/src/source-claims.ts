/**
 * Écarts entre sources — complément atelier, M16.
 *
 * `site_fact` porte une clé unique par site, volontairement : deux valeurs pour
 * « parking gratuit » ne se départagent pas toutes seules, et les stocker toutes
 * deux comme des faits ferait passer une incertitude pour un acquis. Ce module
 * est l'endroit où la seconde valeur a le droit d'exister.
 *
 * Une **affirmation** est ce qu'une source dit d'un objet : la charte annonce
 * trois niveaux de parking, les plans en montrent deux. Tant que deux
 * affirmations divergent, il n'y a pas de fait, il y a un écart.
 *
 * Ce que le module garantit, et qui est le point de M16 : un écart ouvert ne
 * disparaît pas des livrables. Une valeur est retenue pour que la production
 * continue, et elle sort marquée « à confirmer ». Le silence serait le seul
 * comportement dangereux : il ferait lire la valeur retenue comme une valeur
 * vérifiée.
 */

/** Ce qu'une source affirme d'un objet, à une date. */
export type SourceClaim = {
  /** L'objet dont on parle : la même clé que celle d'un fait du site. */
  readonly key: string;
  /** D'où vient l'affirmation. Deux affirmations de même source ne divergent pas. */
  readonly source: string;
  readonly value: string;
  /** Date de l'affirmation, en ISO 8601. Départage les valeurs retenues. */
  readonly recorded_on: string;
};

/** La décision qui clôt un écart, et qui se trace. */
export type DiscrepancyDecision = {
  /** La source dont la valeur est retenue. */
  readonly source: string;
  readonly decided_by: string;
  readonly decided_on: string;
};

export type Discrepancy = {
  readonly key: string;
  /** Les affirmations en présence, par source puis par date. */
  readonly claims: readonly SourceClaim[];
  /** La valeur qui part en production, décidée ou provisoire. */
  readonly retained_value: string;
  readonly retained_source: string;
  /**
   * Vrai tant qu'aucune décision n'a tranché. La valeur retenue est alors
   * provisoire et tout livrable qui la porte doit dire « à confirmer ».
   */
  readonly open: boolean;
  readonly decision: DiscrepancyDecision | null;
};

function byRecency(left: SourceClaim, right: SourceClaim): number {
  // Plus récent d'abord ; à date égale, la source départage pour rester stable.
  return right.recorded_on.localeCompare(left.recorded_on)
    || left.source.localeCompare(right.source);
}

/**
 * Regroupe les affirmations par objet et rend les écarts.
 *
 * Un objet sur lequel toutes les sources s'accordent n'est pas un écart, même
 * si plusieurs sources en parlent : c'est un fait confirmé deux fois.
 *
 * **La valeur provisoire est la plus récente, pas la plus fréquente.** Trois
 * documents anciens répétant la même erreur ne l'emportent pas sur un relevé du
 * mois dernier ; le vote majoritaire confondrait la diffusion d'une valeur avec
 * sa véracité. À date égale, la source départage par ordre alphabétique, faute
 * de mieux, et c'est précisément le cas où la décision humaine s'impose.
 *
 * Les décisions sont fournies par clé. Une décision qui désigne une source
 * absente des affirmations est ignorée : elle a tranché sur un état qui n'existe
 * plus, et la suivre retiendrait une valeur que plus aucune source ne porte.
 */
export function detectDiscrepancies(
  claims: readonly SourceClaim[],
  decisions: Readonly<Record<string, DiscrepancyDecision>> = {},
): readonly Discrepancy[] {
  const byKey = new Map<string, SourceClaim[]>();
  for (const claim of claims) {
    const bucket = byKey.get(claim.key);
    if (bucket === undefined) byKey.set(claim.key, [claim]);
    else bucket.push(claim);
  }

  const discrepancies: Discrepancy[] = [];

  for (const key of [...byKey.keys()].sort((a, b) => a.localeCompare(b))) {
    const bucket = byKey.get(key) ?? [];
    const values = new Set(bucket.map((claim) => claim.value));
    if (values.size < 2) continue;

    const ordered = [...bucket].sort(byRecency);
    const decision = decisions[key];
    const decided = decision === undefined
      ? undefined
      : ordered.find((claim) => claim.source === decision.source);

    const retained = decided ?? ordered[0];
    if (retained === undefined) continue;

    discrepancies.push({
      key,
      claims: [...bucket].sort((left, right) =>
        left.source.localeCompare(right.source)
        || left.recorded_on.localeCompare(right.recorded_on),
      ),
      retained_value: retained.value,
      retained_source: retained.source,
      open: decided === undefined,
      decision: decided === undefined ? null : (decision ?? null),
    });
  }

  return discrepancies;
}

/**
 * Le suffixe qu'un livrable ajoute à une valeur encore discutée.
 *
 * Rendu ici et non dans chaque gabarit : une valeur provisoire qui sortirait
 * nue sur un seul livrable suffirait à la faire passer pour acquise.
 */
export function markIfOpen(discrepancy: Discrepancy, confirmLabel: string): string {
  return discrepancy.open
    ? `${discrepancy.retained_value} (${confirmLabel})`
    : discrepancy.retained_value;
}
