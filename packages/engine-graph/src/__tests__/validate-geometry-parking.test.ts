/**
 * Emprise de parking et validation géométrique — complément atelier, M2.
 *
 * Séparé des essais du socle : réunis, ils franchissaient les quatre cents
 * lignes (A2.4).
 */
import { describe, it, expect } from 'vitest';
import { validateGeometry } from '../validate-geometry.js';
import { siteWith, GOOD_FP } from './geometry-fixtures.js';

describe('emprise de parking (complément atelier M2)', () => {
  it('refuse un contour de parking à moins de trois sommets', () => {
    // Le contrôle ne regardait que les empreintes : une emprise de parking
    // dégénérée passait sans que rien ne le dise.
    const site = {
      ...siteWith([GOOD_FP]),
      parkings: [{
        id: 'park-1',
        org_id: 'org1',
        level_id: 'l1',
        geometry: { vertices: [{ x_m: 0, y_m: 0 }, { x_m: 1, y_m: 0 }] },
        name: 'Ouest',
        free: true,
        declared_capacity: 0,
        provenance: { status: 'existant' as const, source: 'Plan' },
      }],
    };
    const r = validateGeometry(site);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const f = r.findings.find(x => x.code === 'GEOM.POLYGON_TOO_FEW_VERTICES');
    // L'anomalie désigne un parking, pas une empreinte.
    expect(f?.entity).toEqual({ kind: 'parking', id: 'park-1' });
  });
});
