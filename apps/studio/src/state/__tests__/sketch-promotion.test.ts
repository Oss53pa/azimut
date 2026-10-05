import { describe, it, expect } from 'vitest';
import { chainStrokes, strokesInside } from '../sketch-promotion.js';
import type { SketchStroke } from '../sketch.js';

function stroke(id: string, points: readonly (readonly [number, number])[]): SketchStroke {
  return {
    id, tool: 'felt', color: 'graphite', width_base_m: 0.08,
    points: points.map(([x_m, y_m]) => ({ x_m, y_m, p: 0.5 })),
  };
}

const loop = [{ x_m: 0, y_m: 0 }, { x_m: 10, y_m: 0 }, { x_m: 10, y_m: 10 }, { x_m: 0, y_m: 10 }];

describe('J3.3 — la promotion d’une esquisse', () => {
  it('le lasso ne choisit que les traits qu’il entoure entièrement', () => {
    const strokes = [
      stroke('dedans', [[2, 2], [5, 5]]),
      stroke('a-cheval', [[5, 5], [15, 5]]),
      stroke('dehors', [[20, 20], [25, 25]]),
    ];
    expect(strokesInside(loop, strokes)).toEqual(['dedans']);
    expect(strokesInside(loop.slice(0, 2), strokes)).toEqual([]);
  });

  it('les traits se mettent bout à bout, retournés au besoin, quel que soit l’ordre du tracé', () => {
    const bottom = stroke('a', [[0, 0], [4, 0]]);
    const right = stroke('b', [[4, 3], [4, 0]]); // tracé à rebours
    const top = stroke('c', [[4, 3], [0, 3]]);
    const left = stroke('d', [[0, 0], [0, 3]]); // tracé à rebours
    const chained = chainStrokes([top, left, bottom, right], ['a', 'b', 'c', 'd']);
    expect(chained.map(p => [p.x_m, p.y_m])).toEqual([
      [0, 0], [4, 0], [4, 0], [4, 3], [4, 3], [0, 3], [0, 3], [0, 0],
    ]);
    expect(chainStrokes([right, bottom, left, top], ['d', 'c', 'b', 'a'])).toEqual(chained);
  });

  it('la pression ne passe pas dans la saisie : seule la géométrie est lue', () => {
    const chained = chainStrokes([stroke('a', [[1, 2]])], ['a']);
    expect(chained).toEqual([{ x_m: 1, y_m: 2 }]);
  });

  it('rien de choisi, rien à convertir', () => {
    expect(chainStrokes([stroke('a', [[1, 2]])], [])).toEqual([]);
  });
});
