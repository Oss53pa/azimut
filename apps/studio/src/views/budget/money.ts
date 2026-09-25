/**
 * H8 — les montants du budget. Ils sont stockés en unité mineure avec leur
 * devise ; tout calcul se fait en unité mineure, et deux devises ne se
 * comparent ni ne s'additionnent : aucun taux n'est déclaré.
 */
import type { BudgetLine, Money } from '@azimut/core-model';

/**
 * Unités mineures par unité majeure, selon l'exposant ISO 4217 de la devise :
 * 100 pour l'euro, 1 pour le franc CFA, qui n'a pas de sous-unité. Le runtime
 * porte la table ; aucune devise n'est supposée à deux décimales.
 */
export function minorPerMajor(currency: string): number {
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  return 10 ** digits;
}

/** « 124 000 EUR » ; l'unité mineure est arrondie à l'unité majeure pour l'affichage. */
export function formatMoney(money: Money | null, lang: string, unpriced: string): string {
  if (money === null) return unpriced;
  const major = Math.round(money.minor / minorPerMajor(money.currency));
  const text = new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'fr-FR', { maximumFractionDigits: 0 }).format(major);
  return `${text} ${money.currency}`;
}

/** Part de `part` dans `whole`, en pour-cent, si les deux existent dans la même devise. */
export function share(part: Money | null, whole: Money | null): number | null {
  if (part === null || whole === null) return null;
  if (part.currency !== whole.currency || whole.minor === 0) return null;
  return (part.minor / whole.minor) * 100;
}

/** Écart relatif entre réalisé et estimation, en pour-cent, quand les deux existent. */
export function variance(line: BudgetLine): number | null {
  const ratio = share(line.actual, line.estimated);
  return ratio === null ? null : ratio - 100;
}
