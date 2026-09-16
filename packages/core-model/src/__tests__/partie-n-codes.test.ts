import { describe, it, expect } from 'vitest';
import { ERROR_CATALOG } from '../error-catalog.js';
import { ERROR_MESSAGES_FR, ERROR_MESSAGES_EN } from '../i18n-errors.js';
import type { ErrorCode } from '../error-catalog.js';

/**
 * Partie N — les codes que les fiches de modules citent, avec la gravité
 * qu'elles leur donnent.
 *
 * Une règle numérotée de la partie N est opposable (N0) : ce test est
 * l'endroit où elle s'oppose. Changer une gravité ici sans changer la fiche
 * correspondante fait échouer la vérification, dans un sens comme dans l'autre.
 */
const PARTIE_N_CODES: readonly {
  readonly code: ErrorCode;
  readonly severity: 'blocking' | 'warning' | 'info';
  /** Chapitre de la partie N qui le déclare, et la règle qu'il fait respecter. */
  readonly source: string;
}[] = [
  // Module 01 — socle du site
  { code: 'DATA.UNIT_CODE_REQUIRED', severity: 'blocking', source: 'N1.4 · règle S3' },
  { code: 'DATA.CODE_DUPLICATE', severity: 'blocking', source: 'N1.4 · règle S3' },
  { code: 'CALIB.LEVEL_NOT_CALIBRATED', severity: 'blocking', source: 'N1.4' },

  // Module 02 — wayfinding
  { code: 'WAYFIND.LINE_UNJUSTIFIED', severity: 'blocking', source: 'N2.4 · règle W4' },
  { code: 'GRAPH.DECISION_POINT_UNCOVERED', severity: 'blocking', source: 'N2.4' },
  { code: 'GRAPH.SUPPORT_UNUSED', severity: 'warning', source: 'N2.4' },

  // Module 03 — parcours clients
  { code: 'FLOW.WEIGHTS_NOT_NORMALIZED', severity: 'blocking', source: 'N3.3 · règle P1' },
  { code: 'FLOW.CORRELATION_TOO_LOW', severity: 'blocking', source: 'N3.3 · règle P5' },
];

describe('Partie N — codes cités par les fiches de modules', () => {
  it('les huit codes figurent au catalogue', () => {
    const missing = PARTIE_N_CODES
      .filter(entry => !(entry.code in ERROR_CATALOG))
      .map(entry => `${entry.code} (${entry.source})`);
    expect(missing, `codes cités par la partie N et absents du catalogue :\n${missing.join('\n')}`)
      .toEqual([]);
  });

  it('chacun porte la gravité que sa fiche lui donne', () => {
    for (const entry of PARTIE_N_CODES) {
      expect(
        ERROR_CATALOG[entry.code].severity,
        `${entry.code} : la partie N (${entry.source}) le déclare ${entry.severity}`,
      ).toBe(entry.severity);
    }
  });

  it('chacun est traduit dans les deux langues', () => {
    for (const entry of PARTIE_N_CODES) {
      expect(ERROR_MESSAGES_FR[entry.code].length).toBeGreaterThan(0);
      expect(ERROR_MESSAGES_EN[entry.code].length).toBeGreaterThan(0);
    }
  });

  it('n’emploie aucun domaine nouveau : les cinq existaient déjà', () => {
    const domains = new Set(PARTIE_N_CODES.map(entry => entry.code.split('.')[0]));
    expect([...domains].sort()).toEqual(['CALIB', 'DATA', 'FLOW', 'GRAPH', 'WAYFIND']);
  });
});
