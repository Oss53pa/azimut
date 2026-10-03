import { describe, it, expect } from 'vitest';
import { ERROR_CATALOG, ANOMALY_DOMAINS, RETIRED_CODES } from '../error-catalog.js';

/**
 * D2.1 — « Domaines autorisés, et eux seuls. »
 *
 * Ce qui se vérifie ici tient au seul catalogue du dépôt. Que la liste des
 * domaines tienne dans celle de D2.1, et que le catalogue se recoupe avec
 * celui du consolidé dans les deux sens, se vérifie contre le document
 * lui-même dans `tests/catalogue-consolide.test.ts` : une liste recopiée à la
 * main aurait vieilli sans que personne s'en aperçoive, ce qui est arrivé.
 *
 * `NET` n'était autorisé par aucun document. Il figurait pourtant au
 * catalogue, attribué à la « tranche M » — une attribution fausse. C'était
 * aussi une erreur de catégorie : D2.2 réserve le catalogue aux anomalies
 * produites par un moteur, et un moteur n'a ni réseau ni base (A4.1).
 */
describe('D2.1 — domaines autorisés, et eux seuls', () => {
  it('`NET` n’est ni un domaine ni un préfixe de code', () => {
    expect([...ANOMALY_DOMAINS]).not.toContain('NET');
    const codes = Object.keys(ERROR_CATALOG).filter(c => c.startsWith('NET.'));
    expect(codes).toEqual([]);
  });

  it('tout code du catalogue porte un domaine déclaré', () => {
    const declares = new Set<string>(ANOMALY_DOMAINS);
    const hors = Object.keys(ERROR_CATALOG)
      .map(code => code.split('.')[0] ?? '')
      .filter(domain => !declares.has(domain));
    expect([...new Set(hors)].sort()).toEqual([]);
  });
});

/**
 * D2.1 — « Un code est stable à vie. Il n'est jamais renommé, jamais traduit,
 * jamais réutilisé pour un autre sens. Un code retiré est marqué obsolète et
 * sa valeur reste réservée. »
 */
describe('D2.1 — les codes retirés restent réservés', () => {
  it('aucun code retiré ne reparaît au catalogue', () => {
    const revenus = Object.keys(RETIRED_CODES).filter(c => c in ERROR_CATALOG);
    expect(revenus).toEqual([]);
  });

  it('chaque code retiré dit pourquoi', () => {
    for (const [code, reason] of Object.entries(RETIRED_CODES)) {
      expect(reason.length, code).toBeGreaterThan(30);
    }
  });

  it('les neuf codes retirés sont ceux attendus', () => {
    expect(Object.keys(RETIRED_CODES).sort()).toEqual([
      'CALIB.NORTH_MISSING',
      // Retirés par l'éditeur : trois états d'écran de F7, que D2.2 ne
      // catalogue pas, le catalogue étant réservé aux anomalies de moteur.
      'DATA.VOCABULARY_UNREADABLE',
      'EDIT.NOTHING_TO_REDO',
      'EDIT.NOTHING_TO_UNDO',
      'NET.FORBIDDEN',
      'NET.NOT_FOUND',
      'NET.OFFLINE',
      'NET.REQUEST_FAILED',
      'NET.UNAUTHORIZED',
    ]);
  });
});

/**
 * La partie M nomme vingt et un codes dans ses cinq écrans. Sept manquaient au
 * catalogue au moment du versement. Construire un écran de la tranche sans eux
 * aurait obligé à en inventer, ce que la section 7 de la consigne interdit.
 */
describe('partie M — les codes que les cinq écrans nomment', () => {
  const NAMED_BY_PARTIE_M = [
    'CALIB.AZIMUTH_INVALID', 'CALIB.DISTANCE_INVALID', 'CALIB.POINTS_TOO_CLOSE',
    'CALIB.POINT_REQUIRED', 'CALIB.SCALE_IMPLAUSIBLE',
    'DATA.CODE_DUPLICATE', 'DATA.COUNTRY_REQUIRED', 'DATA.LANG_REQUIRED',
    'DATA.NAME_DUPLICATE', 'DATA.NAME_REQUIRED',
    'GEOM.FOOTPRINTS_OVERLAP', 'GEOM.POLYGON_DEGENERATE',
    'GEOM.POLYGON_SELF_INTERSECTING', 'GEOM.POLYGON_TOO_FEW_VERTICES',
    'GRAPH.EDGE_SELF_LOOP', 'GRAPH.EDGE_ZERO_LENGTH', 'GRAPH.VERTICAL_LINK_MISSING',
    'IMPORT.FILE_TOO_LARGE', 'IMPORT.FORMAT_UNSUPPORTED', 'IMPORT.PAGE_REQUIRED',
    'RULES.PACK_NOT_BOUND',
  ];

  it('les vingt et un sont au catalogue', () => {
    const absents = NAMED_BY_PARTIE_M.filter(c => !(c in ERROR_CATALOG));
    expect(absents).toEqual([]);
  });
});
