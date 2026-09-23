import { describe, it, expect } from 'vitest';
import { acceptSeries } from '../footprint-series.js';
import type { FootprintDraft } from '../footprint-input.js';

/**
 * M3 (partie M) critère 4 — « La duplication en série de 20 cellules se fait
 * en une commande annulable d'un seul geste. »
 *
 * Ce fichier porte le jugement de la série. Le geste unique et son annulation
 * se prouvent de bout en bout, dans `tests/e2e/m3-serie.spec.ts` : ils tiennent
 * au magasin de commandes, pas à ce module.
 */
const REFERENCE: FootprintDraft = {
  vertices: [
    { x_m: 0, y_m: 0 }, { x_m: 5, y_m: 0 }, { x_m: 5, y_m: 4 }, { x_m: 0, y_m: 4 },
  ],
  unitCode: 'B01',
  kind: 'cell',
  categoryId: null,
};

const EMPTY = { codesOnLevel: [] as readonly string[], existing: [] as readonly (readonly { x_m: number; y_m: number }[])[] };

describe('M3 (partie M) critère 4 — la duplication en série', () => {
  it('rend vingt copies pour une série de vingt', () => {
    const outcome = acceptSeries(REFERENCE, { dx_m: 6, dy_m: 0, count: 20 }, EMPTY);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value).toHaveLength(20);
  });

  it('dérive un code distinct par copie, à partir de 2', () => {
    const outcome = acceptSeries(REFERENCE, { dx_m: 6, dy_m: 0, count: 20 }, EMPTY);
    if (!outcome.ok) throw new Error('la série doit être acceptée');
    const codes = outcome.value.map(f => f.unitCode);
    expect(codes[0]).toBe('B01-2');
    expect(codes[19]).toBe('B01-21');
    expect(new Set(codes).size).toBe(20);
  });

  /**
   * L'original garde son code et n'est pas reproduit : la série s'ajoute à ce
   * qui est déjà tracé. Le reproduire écrirait deux cellules au même endroit
   * sous deux codes, et le recouvrement le dirait sans que personne l'ait
   * voulu.
   */
  it('n’inclut pas l’original', () => {
    const outcome = acceptSeries(REFERENCE, { dx_m: 6, dy_m: 0, count: 3 }, EMPTY);
    if (!outcome.ok) throw new Error('la série doit être acceptée');
    expect(outcome.value.map(f => f.unitCode)).not.toContain('B01');
    expect(outcome.value[0]?.vertices[0]).toEqual({ x_m: 6, y_m: 0 });
  });

  /**
   * Le pas n'est pas accumulé : la vingtième copie est à vingt fois le pas de
   * l'original, et non à la somme de vingt translations quantifiées. La
   * différence se voit sur un pas qui ne tombe pas juste au millimètre, et
   * c'est là qu'une trame cesse d'être régulière.
   */
  it('place la vingtième copie à vingt fois le pas, sans accumuler l’erreur', () => {
    const outcome = acceptSeries(REFERENCE, { dx_m: 0.3335, dy_m: 0, count: 20 }, EMPTY);
    if (!outcome.ok) throw new Error('la série doit être acceptée');
    expect(outcome.value[19]?.vertices[0]?.x_m).toBe(6.67);
  });

  it('refuse la série entière quand un code y est déjà pris', () => {
    const outcome = acceptSeries(
      REFERENCE, { dx_m: 6, dy_m: 0, count: 3 },
      { ...EMPTY, codesOnLevel: ['B01-2'] },
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.findings.map(f => f.code)).toContain('DATA.CODE_DUPLICATE');
  });

  /**
   * Le contre-exemple du précédent : c'est bien le conflit qui refuse, et non
   * la série en elle-même.
   */
  it('accepte la même série quand le code est libre', () => {
    const outcome = acceptSeries(
      REFERENCE, { dx_m: 6, dy_m: 0, count: 3 },
      { ...EMPTY, codesOnLevel: ['Z99'] },
    );
    expect(outcome.ok).toBe(true);
  });

  it('refuse une série dont un contour est dégénéré', () => {
    const flat: FootprintDraft = {
      ...REFERENCE,
      vertices: [{ x_m: 0, y_m: 0 }, { x_m: 5, y_m: 0 }, { x_m: 10, y_m: 0 }],
    };
    const outcome = acceptSeries(flat, { dx_m: 6, dy_m: 0, count: 2 }, EMPTY);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.findings.map(f => f.code)).toContain('GEOM.POLYGON_DEGENERATE');
  });

  /**
   * Deux copies au même endroit se recouvrent. M3 (partie M) en fait un
   * avertissement et non un refus : le tracé est accepté, et l'écran le dit.
   */
  it('accepte une série sans déplacement, en avertissant du recouvrement', () => {
    const outcome = acceptSeries(REFERENCE, { dx_m: 0, dy_m: 0, count: 2 }, EMPTY);
    expect(outcome.ok).toBe(true);
  });
});
