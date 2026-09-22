/**
 * M5 (partie M) — validation de complétude.
 *
 * L'écran a une règle qui le résume : « Un écran vide qui ressemble à une
 * réussite alors que rien n'a été calculé est le pire des états possibles. »
 * C'est M7.11 (partie M) — « aucun résultat vide n'est présenté comme un
 * succès si le calcul n'a pas eu lieu » — et c'est ce que ce module rend
 * impossible à confondre : l'absence de calcul et l'absence d'anomalie sont
 * deux états distincts, nommés, qui ne se réduisent pas l'un à l'autre.
 */
import type { Finding } from '@azimut/core-model';

/** L'état de la validation, du point de vue de l'écran. */
export type ValidationState =
  /** Jamais lancée. Ni un succès, ni un échec : rien n'a été calculé. */
  | { readonly kind: 'never_run' }
  /** En cours. M5 (partie M) : « Progression, annulable ». */
  | { readonly kind: 'running'; readonly startedAt: string }
  /** Terminée, avec son résultat et la durée réelle du calcul. */
  | {
      readonly kind: 'ran';
      readonly findings: readonly Finding[];
      readonly ranAt: string;
      readonly durationMs: number;
    };

export const NEVER_RUN: ValidationState = { kind: 'never_run' };

// ---------------------------------------------------------------------------
// Groupement et ordre
// ---------------------------------------------------------------------------

/** Les trois gravités, de la plus forte à la plus faible. */
export const SEVERITY_ORDER = ['blocking', 'warning', 'info'] as const;
export type Severity = (typeof SEVERITY_ORDER)[number];

export type EntityGroup = {
  /** L'entité concernée, ou `null` pour les anomalies qui n'en visent aucune. */
  readonly entity: { readonly kind: string; readonly id: string } | null;
  readonly findings: readonly Finding[];
  /** La gravité la plus forte du groupe, qui décide de sa place. */
  readonly severity: Severity;
};

/**
 * M5 (partie M) : « Anomalies groupées par entité, ordonnées par gravité
 * décroissante. »
 *
 * L'ordre est total et déterministe : la gravité d'abord, puis le genre
 * d'entité, puis son identifiant. Sans le départage, deux exécutions du même
 * état rendraient deux listes dans deux ordres, et l'export cesserait d'être
 * reproductible (INV-4).
 */
export function groupByEntity(findings: readonly Finding[]): readonly EntityGroup[] {
  const groups = new Map<string, Finding[]>();
  for (const finding of findings) {
    const key = finding.entity === null
      ? '\u0000none'
      : `${finding.entity.kind}\u0000${finding.entity.id}`;
    const bucket = groups.get(key);
    if (bucket === undefined) groups.set(key, [finding]);
    else bucket.push(finding);
  }

  const built: EntityGroup[] = [];
  for (const bucket of groups.values()) {
    const first = bucket[0];
    if (first === undefined) continue;
    built.push({
      entity: first.entity,
      findings: [...bucket].sort(bySeverityThenCode),
      severity: strongestSeverity(bucket),
    });
  }

  return built.sort((a, b) => {
    const bySeverity = rank(a.severity) - rank(b.severity);
    if (bySeverity !== 0) return bySeverity;
    const aKey = a.entity === null ? '' : `${a.entity.kind}\u0000${a.entity.id}`;
    const bKey = b.entity === null ? '' : `${b.entity.kind}\u0000${b.entity.id}`;
    return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
  });
}

function bySeverityThenCode(a: Finding, b: Finding): number {
  const bySeverity = rank(severityOf(a)) - rank(severityOf(b));
  return bySeverity !== 0 ? bySeverity : (a.code < b.code ? -1 : a.code > b.code ? 1 : 0);
}

function rank(severity: Severity): number {
  return SEVERITY_ORDER.indexOf(severity);
}

function severityOf(finding: Finding): Severity {
  return SEVERITY_ORDER.includes(finding.severity as Severity)
    ? finding.severity as Severity
    : 'info';
}

function strongestSeverity(findings: readonly Finding[]): Severity {
  let best: Severity = 'info';
  for (const finding of findings) {
    if (rank(severityOf(finding)) < rank(best)) best = severityOf(finding);
  }
  return best;
}

/** Le compte par gravité, tel que le bandeau de M5 (partie M) l'affiche. */
export function countsBySeverity(
  findings: readonly Finding[],
): Readonly<Record<Severity, number>> {
  const counts: Record<Severity, number> = { blocking: 0, warning: 0, info: 0 };
  for (const finding of findings) counts[severityOf(finding)] += 1;
  return counts;
}

// ---------------------------------------------------------------------------
// M7.11 (partie M) — ce que l'écran a le droit de dire
// ---------------------------------------------------------------------------

/**
 * Ce que l'écran affiche à la place du résultat.
 *
 * Trois états, et le premier est celui qui compte : « Jamais lancé |
 * Invitation à lancer, jamais un résultat vide présenté comme un succès. »
 */
export type Presentation =
  | { readonly kind: 'invite' }
  | { readonly kind: 'progress' }
  | { readonly kind: 'clean' }
  | { readonly kind: 'findings'; readonly groups: readonly EntityGroup[] };

export function present(state: ValidationState): Presentation {
  if (state.kind === 'never_run') return { kind: 'invite' };
  if (state.kind === 'running') return { kind: 'progress' };
  return state.findings.length === 0
    ? { kind: 'clean' }
    : { kind: 'findings', groups: groupByEntity(state.findings) };
}

/**
 * Le taux de couverture, ou la raison de son absence.
 *
 * M02.W10 (partie N) : « Aucun taux de couverture n'est publié tant que la
 * validation de complétude échoue. » M5 (partie M) ajoute comment le dire :
 * « Le compteur correspondant indique que le calcul est conditionné, il
 * n'affiche jamais zéro ni un tiret. »
 *
 * Un zéro se lit comme un résultat. Un tiret se lit comme une absence de
 * donnée. Ni l'un ni l'autre ne dit « ce calcul attend qu'un autre aboutisse ».
 */
export type CoverageDisplay =
  | { readonly kind: 'value'; readonly ratePct: number }
  | { readonly kind: 'conditioned'; readonly on: 'never_run' | 'blocking_findings' };

export function coverageDisplay(
  state: ValidationState,
  ratePct: number | null,
): CoverageDisplay {
  if (state.kind !== 'ran') return { kind: 'conditioned', on: 'never_run' };
  if (countsBySeverity(state.findings).blocking > 0) {
    return { kind: 'conditioned', on: 'blocking_findings' };
  }
  return ratePct === null
    ? { kind: 'conditioned', on: 'never_run' }
    : { kind: 'value', ratePct };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * M5 (partie M) : « Exporter | Document ou tableur, avec l'horodatage et la
 * version du paquet de règles. »
 *
 * Les deux accompagnements ne sont pas décoratifs : un rapport d'anomalies
 * sans la version des règles qui l'ont produit ne se compare à rien, et ne
 * s'oppose à personne.
 */
export type ValidationExport = {
  readonly ranAt: string;
  readonly durationMs: number;
  readonly rulesPack: { readonly key: string; readonly version: string } | null;
  readonly counts: Readonly<Record<Severity, number>>;
  readonly groups: readonly EntityGroup[];
};

/**
 * Prépare l'export. Refuse quand rien n'a été calculé : exporter un rapport
 * vide d'une validation jamais lancée produirait un document qui ment.
 */
export function prepareExport(
  state: ValidationState,
  rulesPack: { readonly key: string; readonly version: string } | null,
): ValidationExport | null {
  if (state.kind !== 'ran') return null;
  return {
    ranAt: state.ranAt,
    durationMs: state.durationMs,
    rulesPack,
    counts: countsBySeverity(state.findings),
    groups: groupByEntity(state.findings),
  };
}

// ---------------------------------------------------------------------------
// M5 (partie M) — la référence normative
// ---------------------------------------------------------------------------

/**
 * « Une anomalie d'origine normative affiche sa référence documentaire. Une
 * anomalie normative sans référence visible est un défaut, pas un détail de
 * présentation. »
 *
 * A7 décrit `ruleRef` comme la « référence au paquet de règles, si origine
 * normative ». C'est donc lui, et lui seul, qui marque l'origine : une
 * anomalie levée depuis un paquet de règles le porte par construction —
 * `rule-checks.ts` y inscrit le code de la règle.
 *
 * J'avais d'abord classé l'origine par domaine, en tenant tout `LAYOUT` pour
 * normatif. C'était faux : `LAYOUT.ISO_LEVEL_NOT_FOUND` signale un niveau
 * introuvable, un défaut de donnée sans origine réglementaire. Rien dans les
 * quatorze documents ne donne la liste des codes qui devraient être normatifs,
 * et la deviner reviendrait à l'inventer (A2.2).
 *
 * Ce qui reste vérifiable, et qui est ce que M5 (partie M) demande vraiment : l'écran
 * affiche la référence quand elle est là.
 */
export function hasNormativeReference(finding: Finding): boolean {
  return finding.ruleRef !== null && finding.ruleRef !== '';
}

/**
 * Ce que la ligne d'anomalie doit montrer.
 *
 * M5 (partie M) : « Chaque ligne porte le libellé issu du dictionnaire, l'entité
 * concernée, et un lien qui ouvre la zone de travail centrée sur elle avec la
 * sélection déjà faite. »
 */
export type FindingLine = {
  readonly code: string;
  readonly severity: Severity;
  readonly entity: Finding['entity'];
  /** La référence documentaire, quand l'anomalie en porte une. */
  readonly ruleRef: string | null;
  /** Vrai quand la ligne peut ouvrir la zone de travail sur son entité. */
  readonly openable: boolean;
};

export function toLine(finding: Finding): FindingLine {
  return {
    code: finding.code,
    severity: severityOf(finding),
    entity: finding.entity,
    // Jamais masquée : la masquer serait le défaut que M5 (partie M) nomme.
    ruleRef: hasNormativeReference(finding) ? finding.ruleRef : null,
    // Sans entité, il n'y a rien à centrer ni à sélectionner.
    openable: finding.entity !== null,
  };
}
