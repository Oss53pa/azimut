/**
 * D2.2 — refus et avis de saisie qui ne sont pas des anomalies de moteur.
 *
 * « Toute anomalie produite par un moteur figure dans ce catalogue. » Un
 * formulaire qui refuse une date mal écrite ou un texte vide ne produit pas
 * d'anomalie de moteur : il dit à l'opérateur quoi corriger. Ces refus n'ont
 * donc pas de code au catalogue (décision du 28/09/2026) ; l'interface les
 * traduit par leur clé, déclarée dans `FORM_NOTICE_KEYS`.
 *
 * Un formulaire qui rencontre une situation que le catalogue nomme lève, lui,
 * le code du catalogue (`DATA.NAME_REQUIRED`, `EDIT.CONTEXT_VIOLATION`…).
 */
import type { Finding, Outcome } from './outcome.js';

/** Les clés des refus de saisie. L'interface porte une traduction pour chacune. */
export const FORM_NOTICE_KEYS = [
  // Q4 et Q5 — client (entité juridique).
  'form.currency.invalid',
  // O11 — fermeture temporaire.
  'form.closure.edges.required',
  'form.closure.edge.unknown',
  'form.closure.range.invalid',
  'form.closure.reason.required',
  // A5.6 et D8.3 — face de support et bloc libre.
  'form.face.support.unknown',
  'form.face.index.out_of_range',
  'form.face.already_declared',
  'form.face.template.unknown',
  'form.face.lang.inactive',
  'form.block.slot.none',
  'form.block.slot.taken',
  'form.block.template.not_at_hand',
  'form.free_text.empty',
  'form.free_text.lang.outside_face',
  'form.free_text.lang.missing',
] as const;
export type FormNoticeKey = (typeof FORM_NOTICE_KEYS)[number];

export type FormNotice = {
  readonly key: FormNoticeKey;
  /** `blocking` refuse la saisie ; `warning` la laisse passer et le dit. */
  readonly severity: 'blocking' | 'warning';
  readonly params: Readonly<Record<string, string | number>>;
};

/** Le résultat d'un geste de saisie : ses commandes, ou ses refus. */
export type FormOutcome<T> =
  | { readonly ok: true; readonly value: T; readonly warnings: readonly Finding[]; readonly notices: readonly FormNotice[] }
  | { readonly ok: false; readonly findings: readonly Finding[]; readonly notices: readonly FormNotice[] };

export function notice(
  key: FormNoticeKey, severity: FormNotice['severity'] = 'blocking', params: Record<string, string | number> = {},
): FormNotice {
  return { key, severity, params };
}

/** Un refus fait de refus de saisie seulement. */
export function refusedBy(notices: readonly FormNotice[]): FormOutcome<never> {
  return { ok: false, findings: [], notices };
}

/** Le même résultat, vu comme un geste de saisie. */
export function asFormOutcome<T>(outcome: Outcome<T>, notices: readonly FormNotice[] = []): FormOutcome<T> {
  return outcome.ok
    ? { ok: true, value: outcome.value, warnings: outcome.warnings, notices }
    : { ok: false, findings: outcome.findings, notices };
}

/** Un geste d'une seule commande, sous la forme d'une liste. */
export function asList<T>(outcome: FormOutcome<T>): FormOutcome<readonly T[]> {
  return outcome.ok ? { ...outcome, value: [outcome.value] } : outcome;
}
