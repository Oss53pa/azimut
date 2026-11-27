import { describe, it, expect } from 'vitest';
import type { ReconciliationReport } from '../reconciliation.js';
import { csvCell, reconciliationToCsv } from '../reconciliation-export.js';

/**
 * T-1.14 — le rapport de rapprochement est exportable, reproductible, et
 * chaque ligne référence son entité par l'identifiant.
 */
const REPORT: ReconciliationReport = {
  lines: [
    { entity_id: 'sup-1', entity_kind: 'support', issue: 'superfluous', params: { node_id: 'n-9' } },
    { entity_id: 'n-2', entity_kind: 'node', issue: 'uncovered', params: {} },
    { entity_id: 'sup-3', entity_kind: 'support', issue: 'wrong_orientation', params: { tolerance_deg: 5, actual_deg: -12.5 } },
  ],
  superfluous_count: 1, uncovered_count: 1, orientation_count: 1, undersized_count: 0,
};

describe('T-1.14 — l’export du rapport de rapprochement', () => {
  it('une ligne par écart, l’identifiant toujours présent, le libellé en plus', () => {
    const csv = reconciliationToCsv(REPORT, 'fr', l => (l.entity_id === 'n-2' ? 'Hall; RDC' : ''));
    expect(csv.split('\n')).toEqual([
      'Nature;Identifiant;Libellé;Écart;Détail',
      'support;sup-1;;support superflu;node_id=n-9',
      'nœud;n-2;"Hall; RDC";point de décision non couvert;',
      'support;sup-3;;support mal orienté;actual_deg=-12.5 tolerance_deg=5',
    ]);
  });

  it('reproductible : même rapport, mêmes octets', () => {
    expect(reconciliationToCsv(REPORT, 'en')).toBe(reconciliationToCsv(REPORT, 'en'));
    expect(reconciliationToCsv(REPORT, 'en').split('\n')[0]).toBe('Kind;Identifier;Label;Issue;Detail');
  });

  it('une donnée de site ne devient jamais une formule de tableur', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+33')).toBe("'+33");
    expect(csvCell('@SUM')).toBe("'@SUM");
    expect(csvCell('-12.5')).toBe('-12.5');
    expect(csvCell('ligne\nsuivante')).toBe('"ligne\nsuivante"');
  });
});
