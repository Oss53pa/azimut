import { describe, it, expect } from 'vitest';
import {
  SKETCH_BASE_WIDTH_M, eraseCommands, layerVisibilityCommand, readSketch,
  sketchStrokeCommands, strokeStyle, strokesTouched,
} from '../sketch.js';
import type { SketchStroke } from '../sketch.js';

const write = { orgId: 'org', siteId: 'site', levelId: 'niv', timestamp: '2026-10-04T10:00:00.000Z' };
const wobble = [{ x_m: 1.23456, y_m: 2.34567, p: 0.2 }, { x_m: 3.00001, y_m: 2.9, p: 0.9 }];

describe('J3 — la couche d’esquisse', () => {
  it('le premier trait crée la couche du niveau, dans le même geste', () => {
    const out = sketchStrokeCommands(
      { newId: 'couche', name: 'Esquisse' },
      { id: 'trait', tool: 'felt', color: 'brick', points: wobble },
      write,
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.map(c => c.table)).toEqual(['sketch_layer', 'sketch_stroke']);
    expect(new Set(out.value.map(c => c.groupKey)).size).toBe(1);
    expect(out.value.every(c => c.module === '12-atelier')).toBe(true);
  });

  it('le trait est gardé tel quel : ni quantifié, ni redressé, pression comprise', () => {
    const out = sketchStrokeCommands(
      { id: 'couche', visible: true, locked: false },
      { id: 'trait', tool: 'pencil', color: 'graphite', points: wobble },
      write,
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const stroke = out.value[0];
    expect(out.value).toHaveLength(1);
    expect(JSON.parse(String(stroke?.after?.['points']))).toEqual(wobble);
    expect(stroke?.after?.['width_base_m']).toBe(String(SKETCH_BASE_WIDTH_M.pencil));
  });

  it('se relit depuis la session ; un trait gommé ou illisible n’est pas montré', () => {
    const rows = [
      { table: 'sketch_layer', id: 'couche', values: { level_id: 'niv', visible: 'true', locked: 'false' } },
      { table: 'sketch_stroke', id: 'a', values: { layer_id: 'couche', tool: 'felt', color: 'fir', width_base_m: '0.08', points: JSON.stringify(wobble) } },
      { table: 'sketch_stroke', id: 'b', values: { layer_id: 'couche', tool: 'felt', color: 'fir', width_base_m: '0.08', points: JSON.stringify(wobble), deleted_at: write.timestamp } },
      { table: 'sketch_stroke', id: 'c', values: { layer_id: 'couche', tool: 'brosse', color: 'fir', width_base_m: '0.08', points: '[]' } },
    ];
    const sketch = readSketch(rows, 'niv');
    expect(sketch.layer).toEqual({ id: 'couche', visible: true, locked: false });
    expect(sketch.strokes.map(s => s.id)).toEqual(['a']);
    expect(readSketch(rows, 'autre')).toEqual({ layer: null, strokes: [] });
  });

  it('la gomme retire les traits qu’elle touche, d’un seul geste, par suppression logique', () => {
    const strokes: SketchStroke[] = [
      { id: 'loin', tool: 'felt', color: 'fir', width_base_m: 0.08, points: [{ x_m: 50, y_m: 50, p: 0 }, { x_m: 60, y_m: 50, p: 0 }] },
      { id: 'pres', tool: 'felt', color: 'fir', width_base_m: 0.08, points: [{ x_m: 0, y_m: 0, p: 0 }, { x_m: 10, y_m: 0, p: 0 }] },
    ];
    const touched = strokesTouched([{ x_m: 5, y_m: 0.1 }], strokes, 0.2);
    expect(touched).toEqual(['pres']);
    const out = eraseCommands(touched, write);
    expect(out.ok && out.value.map(c => [c.operation, c.after?.['deleted_at']])).toEqual([['update', write.timestamp]]);
  });

  it('la couche se masque et se remontre', () => {
    const out = layerVisibilityCommand({ id: 'couche', visible: true, locked: false }, false, write);
    expect(out.ok && [out.value.before?.['visible'], out.value.after?.['visible']]).toEqual([true, false]);
  });

  it('la pression module l’épaisseur et l’opacité ; le marqueur reste translucide', () => {
    expect(strokeStyle('felt', 1).widthFactor).toBeGreaterThan(strokeStyle('felt', 0.1).widthFactor);
    expect(strokeStyle('pencil', 1).opacity).toBeGreaterThan(strokeStyle('pencil', 0.1).opacity);
    expect(strokeStyle('marker', 1).opacity).toBe(strokeStyle('marker', 0.2).opacity);
    expect(strokeStyle('felt', 0)).toEqual(strokeStyle('felt', 0.5));
  });
});
