/**
 * Places de stationnement et validation géométrique — section S8.
 *
 * Séparé des essais du socle : réunis, ils franchissaient les quatre cents
 * lignes (A2.4).
 *
 * Cet essai portait sur l'emprise d'une table `parking`, que la section S8 a
 * retirée : « un parking est une zone de nature `parking` », et une zone n'a
 * pas de géométrie propre — elle déclare les empreintes qu'elle couvre (A5.2).
 * Ce qu'il tenait reste à tenir : une place de stationnement dégénérée ne doit
 * pas passer. Elle est maintenant une empreinte, donc les quatre contrôles
 * polygonaux la voient sans qu'on ait à les allonger, et c'est précisément ce
 * que cet essai vérifie.
 */
import { describe, it, expect } from 'vitest';
import type { Footprint } from '@azimut/core-model';
import { validateGeometry } from '../validate-geometry.js';
import { siteWith, GOOD_FP } from './geometry-fixtures.js';

describe('place de stationnement', () => {
  it('refuse un contour de place à moins de trois sommets', () => {
    const place: Footprint = {
      id: 'fp-place-1',
      org_id: 'org1',
      level_id: 'l1',
      geometry: { vertices: [{ x_m: 0, y_m: 0 }, { x_m: 1, y_m: 0 }] },
      kind: 'parking_space',
    };
    const r = validateGeometry(siteWith([GOOD_FP, place]));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const f = r.findings.find(x => x.code === 'GEOM.POLYGON_TOO_FEW_VERTICES');
    expect(f?.entity).toEqual({ kind: 'footprint', id: 'fp-place-1' });
  });
});
