/**
 * Le décor partagé des essais du chargeur de paquets de règles : un paquet
 * valide et une règle construite à la demande. Réparti entre plusieurs
 * fichiers d'essais pour tenir la limite de 400 lignes (A2.4).
 */
import type { RulesPackRule } from '../schema.js';

export function validPack(overrides?: Record<string, unknown>) {
  return JSON.stringify({
    key: 'erp-france',
    version: '2024.1',
    jurisdiction: 'FR',
    effective_from: '2024-01-01',
    source_ref: 'Arrêté du 25 juin 1980, art. GN 8',
    rules: [
      {
        code: 'MIN_CHAR_HEIGHT_MM',
        scope: { supportRegistry: 'wayfinding' },
        params: { height_mm: 15 },
        source_ref: 'NF P98-405:2021, §5.2',
      },
      {
        code: 'MIN_CONTRAST_RATIO',
        scope: {},
        params: { ratio: 3 },
        source_ref: 'NF EN 16160:2024, §7.1',
      },
    ],
    ...overrides,
  });
}

export function makeRule(
  code: string,
  scope: Record<string, string>,
): RulesPackRule {
  return {
    code,
    scope,
    params: {},
    source_ref: 'Test ref',
  };
}
