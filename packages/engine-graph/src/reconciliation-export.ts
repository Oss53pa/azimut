import { codePointCompare } from '@azimut/core-model';
import type { ReconciliationLine, ReconciliationReport } from './reconciliation.js';

/**
 * T-1.14 — « le rapport est reproductible et exportable. Chaque ligne
 * référence une entité par son identifiant, jamais par son libellé seul. »
 *
 * Un tableur, une ligne par écart, dans l'ordre du rapport, que `reconcile`
 * rend déjà déterministe : même rapport, mêmes octets (INV-4). Les paramètres
 * d'une ligne s'écrivent `clé=valeur`, triés par clé. Le libellé, quand
 * l'appelant en donne un, s'ajoute à l'identifiant ; il ne le remplace
 * jamais.
 *
 * Une cellule qui commencerait par `=`, `+`, `-` ou `@` sans être un nombre
 * est préfixée d'une apostrophe : un tableur l'évaluerait sinon comme une
 * formule, et une donnée de site ne doit jamais s'exécuter à l'ouverture.
 */
export type ReconciliationLang = 'fr' | 'en';

const LABELS: Readonly<Record<ReconciliationLang, {
  readonly kind: string; readonly id: string; readonly label: string;
  readonly issue: string; readonly detail: string;
  readonly kinds: Readonly<Record<ReconciliationLine['entity_kind'], string>>;
  readonly issues: Readonly<Record<ReconciliationLine['issue'], string>>;
}>> = {
  fr: {
    kind: 'Nature', id: 'Identifiant', label: 'Libellé', issue: 'Écart', detail: 'Détail',
    kinds: { support: 'support', node: 'nœud' },
    issues: {
      superfluous: 'support superflu', uncovered: 'point de décision non couvert',
      wrong_orientation: 'support mal orienté', undersized: 'support sous-dimensionné',
    },
  },
  en: {
    kind: 'Kind', id: 'Identifier', label: 'Label', issue: 'Issue', detail: 'Detail',
    kinds: { support: 'support', node: 'node' },
    issues: {
      superfluous: 'superfluous support', uncovered: 'uncovered decision point',
      wrong_orientation: 'wrongly oriented support', undersized: 'undersized support',
    },
  },
};

const NUMBER = /^-?\d+(\.\d+)?$/;

/** Une cellule de tableur, ni formule ni rupture de ligne. */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) && !NUMBER.test(value) ? `'${value}` : value;
  return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function detail(params: ReconciliationLine['params']): string {
  return Object.keys(params).sort(codePointCompare).map(k => `${k}=${String(params[k])}`).join(' ');
}

/** Le rapport en tableur ; `labelOf` donne, s'il le peut, un libellé lisible. */
export function reconciliationToCsv(
  report: ReconciliationReport,
  lang: ReconciliationLang = 'fr',
  labelOf: (line: ReconciliationLine) => string = () => '',
): string {
  const l = LABELS[lang];
  const out = [[l.kind, l.id, l.label, l.issue, l.detail].map(csvCell).join(';')];
  for (const line of report.lines) {
    out.push([
      l.kinds[line.entity_kind], line.entity_id, labelOf(line), l.issues[line.issue], detail(line.params),
    ].map(csvCell).join(';'));
  }
  return out.join('\n');
}
