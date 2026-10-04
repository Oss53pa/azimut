import { describe, it, expect } from 'vitest';
import {
  alternativeReading, currentReading, footprintReadings, isTracingTool, nextReading,
  strokeToFootprint,
} from '../footprint-ink.js';
import type { StrokeContext } from '../footprint-ink.js';
import { loop, rotate } from '../../editor/ink/__tests__/ink-fixtures.js';

const context = (overrides: Partial<StrokeContext> = {}): StrokeContext => ({
  tool: 'cell', pointer: 'pen', pxPerMeter: 20, strictness: 'normal', footprints: [], ...overrides,
});

const rect = [{ x_m: 0, y_m: 0 }, { x_m: 6, y_m: 0 }, { x_m: 6, y_m: 4 }, { x_m: 0, y_m: 4 }];
const trapeze = [{ x_m: 0, y_m: 0 }, { x_m: 8, y_m: 0 }, { x_m: 6, y_m: 4 }, { x_m: 2, y_m: 4 }];

describe('J1.1 et J2 — un trait dans l’atelier des empreintes', () => {
  it('l’outil cellule applique le rectangle reconnu au contour en cours', () => {
    const out = strokeToFootprint(rotate(loop(rect, 20, 0.05), 2), context());
    expect(out.kind).toBe('applied');
    if (out.kind !== 'applied') return;
    const reading = currentReading(out.arbitration);
    expect(reading?.kind).toBe('rectangle');
    expect(reading?.vertices).toHaveLength(4);
    expect(out.arbitration.ghost.length).toBeGreaterThan(10);
  });

  it('un trapèze se lit en polygone ; l’outil rectangle n’en fait rien', () => {
    const drawn = loop(trapeze, 20, 0.02);
    const asCell = strokeToFootprint(drawn, context());
    expect(asCell.kind === 'applied' && currentReading(asCell.arbitration)?.kind).toBe('polygon');
    expect(strokeToFootprint(drawn, context({ tool: 'rectangle' })).kind).toBe('unrecognized');
  });

  it('les outils qui ne tracent pas le disent, au lieu de lire le trait', () => {
    expect(strokeToFootprint(loop(rect), context({ tool: 'select' }))).toEqual({ kind: 'not_tracing_tool' });
    expect(isTracingTool('vertex')).toBe(false);
    expect(isTracingTool('free_polygon')).toBe(true);
  });

  it('un trait qui n’est pas un contour n’est pas une empreinte', () => {
    const line = [{ x_m: 0, y_m: 0 }, { x_m: 5, y_m: 0.1 }, { x_m: 10, y_m: 0 }];
    expect(strokeToFootprint(line, context()).kind).toBe('unrecognized');
  });

  it('l’autre lecture se prend en un geste, et l’on revient à la première', () => {
    const arbitration = {
      readings: [
        { kind: 'rectangle' as const, vertices: rect },
        { kind: 'polygon' as const, vertices: trapeze },
      ],
      index: 0,
      ghost: [],
    };
    expect(alternativeReading(arbitration)?.kind).toBe('polygon');
    const once = nextReading(arbitration);
    expect(currentReading(once)?.kind).toBe('polygon');
    expect(currentReading(nextReading(once))?.kind).toBe('rectangle');
  });

  it('un rectangle et un polygone aux mêmes sommets ne font qu’une lecture', () => {
    const readings = footprintReadings([
      { kind: 'rectangle', vertices: rect },
      { kind: 'polygon', vertices: rect },
    ], 'cell');
    expect(readings).toEqual([{ kind: 'rectangle', vertices: rect }]);
  });

  it('le polygone libre préfère le polygone', () => {
    const readings = footprintReadings([
      { kind: 'rectangle', vertices: rect },
      { kind: 'polygon', vertices: trapeze },
    ], 'free_polygon');
    expect(readings.map(r => r.kind)).toEqual(['polygon', 'rectangle']);
  });
});
