import { describe, it, expect } from 'vitest';
import {
  parseRoute, buildPath, tranchePath, M_ROUTES, TRANCHE_ORDER,
} from '../routes.js';

/** F15 — les cinq chemins de la partie M, mot pour mot. */
describe('routes de la tranche M (partie M)', () => {
  it('les cinq motifs sont ceux de la partie M', () => {
    expect(M_ROUTES.map(r => r.pattern)).toEqual([
      '/sites',
      '/sites/:siteId/levels/:levelId/plan',
      '/sites/:siteId/levels/:levelId/footprints',
      '/sites/:siteId/levels/:levelId/graph',
      '/sites/:siteId/validation',
    ]);
  });

  it('analyse la liste des sites', () => {
    expect(parseRoute('/sites')).toEqual({ screen: 'sites' });
  });

  it('analyse les trois écrans d’atelier', () => {
    expect(parseRoute('/sites/s1/levels/l1/plan'))
      .toEqual({ screen: 'plan', siteId: 's1', levelId: 'l1' });
    expect(parseRoute('/sites/s1/levels/l1/footprints'))
      .toEqual({ screen: 'footprints', siteId: 's1', levelId: 'l1' });
    expect(parseRoute('/sites/s1/levels/l1/graph'))
      .toEqual({ screen: 'graph', siteId: 's1', levelId: 'l1' });
  });

  it('analyse la validation, qui n’a pas de niveau', () => {
    expect(parseRoute('/sites/s1/validation'))
      .toEqual({ screen: 'validation', siteId: 's1' });
  });

  /** `/sites` ne doit pas capturer ce qui le suit. */
  it('ne confond pas la liste avec ce qui en dépend', () => {
    expect(parseRoute('/sites').screen).toBe('sites');
    expect(parseRoute('/sites/s1/validation').screen).toBe('validation');
  });

  it('renvoie à l’atelier existant pour tout autre chemin', () => {
    expect(parseRoute('/')).toEqual({ screen: 'legacy', path: '/' });
    expect(parseRoute('/sites/s1/levels/l1/inconnu').screen).toBe('legacy');
  });

  it('tolère une barre finale et une barre double', () => {
    expect(parseRoute('/sites/').screen).toBe('sites');
    expect(parseRoute('//sites//s1//validation//').screen).toBe('validation');
  });

  describe('construction', () => {
    it('est l’inverse exact de l’analyse', () => {
      for (const path of [
        '/sites',
        '/sites/s1/levels/l1/plan',
        '/sites/s1/levels/l1/footprints',
        '/sites/s1/levels/l1/graph',
        '/sites/s1/validation',
      ]) {
        expect(buildPath(parseRoute(path)), path).toBe(path);
      }
    });

    /** Un identifiant qui contient une barre ne doit pas fabriquer un chemin. */
    it('échappe les identifiants', () => {
      const path = buildPath({ screen: 'validation', siteId: 'a/b' });
      expect(path).toBe('/sites/a%2Fb/validation');
      expect(parseRoute(path)).toEqual({ screen: 'validation', siteId: 'a/b' });
    });
  });

  /**
   * M8 (partie M) critère 1 : « un opérateur part d'un site vide, importe un
   * plan, le cale, trace trois cellules, pose quatre nœuds, trace les arêtes,
   * lance la validation ». L'ordre est celui de la chaîne.
   */
  describe('la chaîne de M8 (partie M)', () => {
    it('suit l’ordre du parcours', () => {
      expect([...TRANCHE_ORDER]).toEqual(['sites', 'plan', 'footprints', 'graph', 'validation']);
    });

    it('donne un chemin pour chaque étape', () => {
      const paths = TRANCHE_ORDER.map(step => tranchePath(step, 's1', 'l1'));
      expect(paths).toEqual([
        '/sites',
        '/sites/s1/levels/l1/plan',
        '/sites/s1/levels/l1/footprints',
        '/sites/s1/levels/l1/graph',
        '/sites/s1/validation',
      ]);
    });

    it('chaque chemin de la chaîne se réanalyse en son écran', () => {
      for (const step of TRANCHE_ORDER) {
        expect(parseRoute(tranchePath(step, 's1', 'l1')).screen, step).toBe(step);
      }
    });
  });
});
