import { describe, it, expect } from 'vitest';
import { StoredRowUnreadable, pointOrRefuse, polygonOrRefuse, storedPoint, storedPolygon } from '../mapping/stored-shapes.js';

const square = { vertices: [{ x_m: 0, y_m: 0 }, { x_m: 4, y_m: 0 }, { x_m: 4, y_m: 3 }, { x_m: 0, y_m: 3 }] };

describe('relire une colonne jsonb au lieu de la transtyper', () => {
  it('un point et un polygone bien formés se relisent tels quels', () => {
    expect(storedPoint({ x_m: 1.5, y_m: -2 })).toEqual({ x_m: 1.5, y_m: -2 });
    expect(storedPolygon(square)).toEqual(square);
  });

  it('une forme mal formée ne se relit pas', () => {
    for (const bad of [{ x: 0, y: 0 }, { x_m: 0 }, { x_m: '0', y_m: 0 }, { x_m: 0, y_m: Number.NaN },
      { x_m: 0, y_m: 0, z_m: 0 }, [0, 0], null]) expect(storedPoint(bad)).toBeNull();
    for (const bad of [{ vertices: square.vertices.slice(0, 2) }, { vertices: [{ x: 0, y: 0 }, ...square.vertices] },
      square.vertices, { vertices: square.vertices, extra: 1 }, null]) expect(storedPolygon(bad)).toBeNull();
  });

  it('le refus nomme la table et la ligne, jamais le contenu', () => {
    const run = () => pointOrRefuse('node', 'n-1', 'position', { x: 12.345, y: 0 });
    expect(run).toThrow(StoredRowUnreadable);
    try { run(); } catch (e: unknown) {
      expect(e).toMatchObject({ table: 'node', rowId: 'n-1' });
      expect(String(e)).not.toContain('12.345');
    }
    expect(polygonOrRefuse('footprint', 'f-1', 'geometry', square)).toEqual(square);
  });
});
