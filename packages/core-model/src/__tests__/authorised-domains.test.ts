import { describe, it, expect } from 'vitest';
import { ERROR_CATALOG, ANOMALY_DOMAINS, RETIRED_CODES } from '../error-catalog.js';

/**
 * D2.1 — « Domaines autorisés, et eux seuls. »
 *
 * La liste s'accumule d'un document à l'autre : D2.1 en pose neuf, E17 en
 * ajoute quatre, G8 deux, H12 six, I6 trois, J8 cinq, et la partie M un. Trente
 * en tout, et aucun autre.
 *
 * `NET` n'était autorisé par aucun d'eux. Il figurait pourtant au catalogue,
 * attribué à la « tranche M » — une attribution fausse, la partie M ne le
 * nommant nulle part. C'était aussi une erreur de catégorie : D2.2 réserve le
 * catalogue aux anomalies produites par un moteur, et un moteur n'a ni réseau
 * ni base (A4.1).
 *
 * Ce contrôle existe pour que cela ne se reproduise pas sans qu'on le voie.
 */
describe('D2.1 — domaines autorisés, et eux seuls', () => {
  /**
   * La liste vient des documents, pas du code. La comparer à celle du
   * catalogue est le seul moyen de voir un domaine ajouté sans mandat.
   *
   * `PARK` et `DOC` viennent du complément « atelier », versé sans faire foi
   * contre les quatorze. Ils sont tolérés et nommés comme tels.
   */
  const FROM_DOCUMENTS = new Set([
    // D2.1
    'GRAPH', 'GEOM', 'LAYOUT', 'RULES', 'CHARTER', 'IMPORT', 'PACKAGE', 'SECURITY', 'DATA',
    // E17
    'EDIT', 'ASSET', 'TYPO', 'COLOR',
    // G8
    'RENDER', 'FONT',
    // H12
    'WAYFIND', 'FLOW', 'AD', 'TENANT', 'INSTALL', 'COST',
    // I6
    'ASSIST', 'MODULE', 'SURVEY',
    // J8
    'INK', 'SKETCH', 'REVIEW', 'PICTO', 'LIBRARY',
    // Partie M
    'CALIB',
    // Complément « atelier », versé sans faire foi contre les quatorze.
    'PARK', 'DOC',
  ]);

  it('aucun domaine du catalogue n’est absent des documents', () => {
    const sans = [...ANOMALY_DOMAINS].filter(d => !FROM_DOCUMENTS.has(d)).sort();
    expect(sans).toEqual([]);
  });

  it('`NET` n’est ni un domaine ni un préfixe de code', () => {
    expect([...ANOMALY_DOMAINS]).not.toContain('NET');
    const codes = Object.keys(ERROR_CATALOG).filter(c => c.startsWith('NET.'));
    expect(codes).toEqual([]);
  });

  it('tout code du catalogue porte un domaine autorisé', () => {
    const hors = Object.keys(ERROR_CATALOG)
      .map(code => code.split('.')[0] ?? '')
      .filter(domain => !FROM_DOCUMENTS.has(domain));
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

  it('les six codes retirés sont ceux attendus', () => {
    expect(Object.keys(RETIRED_CODES).sort()).toEqual([
      'CALIB.NORTH_MISSING',
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
