import { describe, it, expect } from 'vitest';
import { recognize } from '../recognize.js';
import type { InkCandidate } from '../recognize.js';
import { STRICTNESS_LEVELS } from '../recognition-thresholds.js';
import {
  allMillimetre, context, ellipseStroke, isMillimetre, loop, rotate, stroke,
} from './ink-fixtures.js';

function first(candidates: readonly InkCandidate[]): InkCandidate {
  const head = candidates[0];
  if (head === undefined) throw new Error('aucune candidate');
  return head;
}

function kinds(candidates: readonly InkCandidate[]): readonly string[] {
  return candidates.map(c => c.kind);
}

describe('J1.2 — point appuyé', () => {
  it('devient un nœud, au millimètre', () => {
    const tap = [{ x_m: 3.00012, y_m: 4.99987 }, { x_m: 3.0004, y_m: 5.0001 }];
    expect(recognize(tap, context())).toEqual([{ kind: 'node', at: { x_m: 3, y_m: 5 } }]);
  });
});

describe('J1.2 — traits presque droits', () => {
  it('presque horizontal : segment contraint sur l’axe', () => {
    const out = first(recognize(stroke({ x_m: 1, y_m: 2 }, { x_m: 11, y_m: 2.6 }, 40, 0.05), context()));
    expect(out.kind).toBe('segment');
    if (out.kind !== 'segment') return;
    expect(out.constraint).toBe('axis');
    expect(out.from).toEqual({ x_m: 1, y_m: 2 });
    expect(out.to.y_m).toBe(2);
    expect(allMillimetre([out.from, out.to])).toBe(true);
  });

  it('proche d’un angle remarquable : segment aligné sur l’angle', () => {
    const out = first(recognize(stroke({ x_m: 0, y_m: 0 }, rotate([{ x_m: 10, y_m: 0 }], 43)[0] ?? { x_m: 0, y_m: 0 }), context()));
    expect(out.kind === 'segment' && out.constraint).toBe('angle');
    if (out.kind !== 'segment') return;
    expect(Math.abs(out.to.x_m - out.to.y_m)).toBeLessThan(0.002);
  });

  it('loin de tout angle remarquable : segment libre', () => {
    const out = first(recognize(stroke({ x_m: 0, y_m: 0 }, rotate([{ x_m: 10, y_m: 0 }], 37)[0] ?? { x_m: 0, y_m: 0 }), context()));
    expect(out.kind === 'segment' && out.constraint).toBe('free');
  });

  it('un trait sinueux ouvert n’est rien de ce que J1.2 reconnaît', () => {
    const wave = Array.from({ length: 60 }, (_, i) => ({ x_m: i * 0.2, y_m: Math.sin(i * 0.3) * 2 }));
    expect(recognize(wave, context())).toEqual([]);
  });
});

describe('J1.2 et J1.3 — contours fermés, redressés d’un bloc', () => {
  const rect = [{ x_m: 0, y_m: 0 }, { x_m: 10, y_m: 0 }, { x_m: 10, y_m: 6 }, { x_m: 0, y_m: 6 }];

  it('un rectangle à main levée devient un rectangle aux angles droits, sur les axes', () => {
    const drawn = rotate(loop(rect, 20, 0.08), 3);
    const out = first(recognize(drawn, context()));
    expect(out.kind).toBe('rectangle');
    if (out.kind !== 'rectangle') return;
    expect(out.vertices).toHaveLength(4);
    expect(allMillimetre(out.vertices)).toBe(true);
    const xs = new Set(out.vertices.map(v => v.x_m));
    const ys = new Set(out.vertices.map(v => v.y_m));
    expect(xs.size).toBe(2);
    expect(ys.size).toBe(2);
  });

  it('un rectangle tourné garde son orientation, et ses angles deviennent droits', () => {
    const out = first(recognize(rotate(loop(rect, 20, 0.05), 20), context()));
    expect(out.kind).toBe('rectangle');
    if (out.kind !== 'rectangle') return;
    const [a, b, c] = out.vertices;
    if (a === undefined || b === undefined || c === undefined) throw new Error('sommets');
    const dot = (b.x_m - a.x_m) * (c.x_m - b.x_m) + (b.y_m - a.y_m) * (c.y_m - b.y_m);
    expect(Math.abs(dot)).toBeLessThan(0.01);
  });

  it('un triangle est un polygone, pas un rectangle', () => {
    const tri = [{ x_m: 0, y_m: 0 }, { x_m: 8, y_m: 0 }, { x_m: 3, y_m: 7 }];
    const out = recognize(loop(tri, 25, 0.03), context());
    expect(first(out).kind).toBe('polygon');
    expect(kinds(out)).not.toContain('rectangle');
  });

  it('un cercle approximatif devient un cercle', () => {
    const out = first(recognize(ellipseStroke({ x_m: 5, y_m: 5 }, 3, 3.1, 0, 80, 0.04), context()));
    expect(out.kind === 'ellipse' && out.circle).toBe(true);
    if (out.kind !== 'ellipse') return;
    expect(isMillimetre(out.rx_m) && out.rx_m === out.ry_m).toBe(true);
    expect(Math.abs(out.rx_m - 3.05)).toBeLessThan(0.1);
  });

  it('un ovale devient une ellipse, avec son orientation', () => {
    const out = first(recognize(ellipseStroke({ x_m: 0, y_m: 0 }, 4, 2, 30), context()));
    expect(out.kind === 'ellipse' && !out.circle).toBe(true);
    if (out.kind !== 'ellipse') return;
    expect(Math.abs(out.rotation_deg - 30)).toBeLessThan(1);
  });
});

describe('J1.2 — gestes sur ce qui est déjà posé', () => {
  const nodes = [{ id: 'n-b', at: { x_m: 10, y_m: 0 } }, { id: 'n-a', at: { x_m: 0, y_m: 0 } }];

  it('un trait qui rejoint deux nœuds propose d’abord l’arête', () => {
    const bent = stroke({ x_m: 0.05, y_m: 0 }, { x_m: 9.95, y_m: 0.05 }, 40, 0.6);
    const out = recognize(bent, context({ nodes }));
    expect(first(out)).toEqual({ kind: 'edge', fromNodeId: 'n-a', toNodeId: 'n-b' });
  });

  it('un trait qui barre une forme propose la suppression, jamais en premier', () => {
    const shapes = [{ id: 'cellule', outline: [{ x_m: 2, y_m: -1 }, { x_m: 4, y_m: -1 }, { x_m: 4, y_m: 1 }, { x_m: 2, y_m: 1 }] }];
    const out = recognize(stroke({ x_m: 0, y_m: 0 }, { x_m: 6, y_m: 0.2 }), context({ shapes }));
    expect(kinds(out)).toEqual(['segment', 'strike']);
    expect(out[1]).toEqual({ kind: 'strike', shapeIds: ['cellule'] });
  });

  it('une boucle autour de plusieurs formes est d’abord une sélection', () => {
    const square = (id: string, x: number) => ({
      id, outline: [{ x_m: x, y_m: 1 }, { x_m: x + 1, y_m: 1 }, { x_m: x + 1, y_m: 2 }, { x_m: x, y_m: 2 }],
    });
    const shapes = [square('z', 1), square('a', 4)];
    const around = ellipseStroke({ x_m: 3.5, y_m: 1.5 }, 4, 2.5);
    const out = recognize(around, context({ shapes }));
    expect(first(out)).toEqual({ kind: 'lasso', shapeIds: ['a', 'z'], nodeIds: [] });
  });
});

describe('J0 et J1.3 — déterminisme et quantification', () => {
  it('un même trait rend toujours les mêmes candidates, à tout niveau d’intensité', () => {
    const drawn = rotate(loop([{ x_m: 0, y_m: 0 }, { x_m: 7, y_m: 0 }, { x_m: 7, y_m: 4 }, { x_m: 0, y_m: 4 }], 20, 0.06), 2);
    for (const strictness of STRICTNESS_LEVELS) {
      expect(recognize(drawn, context({ strictness }))).toEqual(recognize(drawn, context({ strictness })));
    }
  });

  it('toute coordonnée rendue est un nombre entier de millimètres', () => {
    const drawn = loop([{ x_m: 0.1234, y_m: 0.5678 }, { x_m: 7.891, y_m: 0.4 }, { x_m: 7.7, y_m: 4.4321 }, { x_m: 0.2, y_m: 4.1 }], 20, 0.06);
    for (const candidate of recognize(drawn, context())) {
      if (candidate.kind === 'polygon' || candidate.kind === 'rectangle') {
        expect(allMillimetre(candidate.vertices)).toBe(true);
      }
    }
  });

  it('une vue sans échelle ne reconnaît rien', () => {
    expect(recognize(stroke({ x_m: 0, y_m: 0 }, { x_m: 1, y_m: 0 }), context({ pxPerMeter: 0 }))).toEqual([]);
  });
});
