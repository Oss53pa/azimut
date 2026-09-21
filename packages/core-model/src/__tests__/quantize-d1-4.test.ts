import { describe, it, expect } from 'vitest';
import { quantizePosition, quantizePoint } from '../view-transform.js';
import { roundHalfAwayFromZero } from '../round.js';

/**
 * D1.4 — une seule primitive d'arrondi, « au plus loin de zéro », et le zéro
 * négatif interdit en sortie.
 *
 * `quantizePosition` employait `Math.round`. Deux écarts, trouvés par le
 * critère 3 de M3 (partie M) — « une empreinte tracée à la souris et la même
 * saisie au clavier produisent des données identiques » — et non par relecture.
 */
describe('D1.4 — quantification au millimètre', () => {
  it('arrondit au plus loin de zéro, comme la primitive unique', () => {
    // `Math.round(-0.5)` rend -0 ; « au plus loin de zéro » rend -1.
    expect(quantizePosition(-0.0005)).toBe(-0.001);
    expect(quantizePosition(0.0005)).toBe(0.001);
  });

  it('s’accorde avec la primitive unique sur tout le domaine essayé', () => {
    for (let micro = -5000; micro <= 5000; micro += 7) {
      const metres = micro / 1_000_000;
      const attendu = roundHalfAwayFromZero(metres * 1000) / 1000;
      expect(quantizePosition(metres), String(metres)).toBeCloseTo(attendu, 12);
    }
  });

  it('ne rend jamais de zéro négatif', () => {
    expect(Object.is(quantizePosition(-0.0001), -0)).toBe(false);
    expect(Object.is(quantizePosition(-0), -0)).toBe(false);
    expect(quantizePosition(-0.0001)).toBe(0);
  });

  /**
   * Le cas qui a révélé le défaut : un sommet posé au pointeur à un micron
   * sous l'origine, et le même saisi au clavier.
   */
  it('un sommet au pointeur et le même au clavier donnent le même point', () => {
    expect(quantizePoint({ x_m: -0.00009, y_m: 0.0001 }))
      .toEqual(quantizePoint({ x_m: 0, y_m: 0 }));
  });
});
