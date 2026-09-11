import { describe, it, expect } from 'vitest';
import { qualifyCad } from '../qualify-cad.js';
import type { CadEntitySet, CadEntity } from '../qualify-cad.js';

function poly(layer: string, closed: boolean, signature?: string): CadEntity {
  return signature === undefined
    ? { kind: 'polyline', layer, closed }
    : { kind: 'polyline', layer, closed, signature };
}

function cleanSet(): CadEntitySet {
  return {
    entities: [
      poly('WALLS', true),
      poly('WALLS', true),
      poly('WALLS', true),
      poly('WALLS', true),
    ],
    layers: [
      { name: 'WALLS', exploitable: true },
      { name: 'DOORS', exploitable: true },
    ],
    declaredUnit: 'mm',
    missingXrefs: [],
    levelCount: 1,
  };
}

describe('D4.3 qualifyCad', () => {
  it('recommends import for a clean file', () => {
    const report = qualifyCad(cleanSet());
    expect(report.recommendation).toBe('import');
    expect(report.closedPolylineCount).toBe(4);
    expect(report.closedPolylineRatio).toBe(1);
    expect(report.exploitableLayerRate).toBe(1);
    expect(report.unitDeclared).toBe(true);
    expect(report.expectedExtractionRate).toBeGreaterThanOrEqual(0.6);
    expect(report.reasons).toEqual([]);
  });

  it('recommends manual tracing below the threshold and says why', () => {
    const messy: CadEntitySet = {
      entities: [
        poly('L1', false),
        poly('L1', false),
        poly('L1', true),
        { kind: 'line', layer: 'L2' },
      ],
      layers: [
        { name: 'L1', exploitable: false },
        { name: 'L2', exploitable: false },
        { name: 'L3', exploitable: true },
      ],
      declaredUnit: null,
      missingXrefs: ['grid.dwg', 'title.dwg'],
      levelCount: 3,
    };
    const report = qualifyCad(messy);
    expect(report.recommendation).toBe('manual_tracing');
    expect(report.expectedExtractionRate).toBeLessThan(0.6);
    expect(report.reasons).toContain('unité non déclarée');
    expect(report.reasons.some((r) => r.includes('niveaux'))).toBe(true);
    expect(report.reasons.some((r) => r.includes('référence'))).toBe(true);
  });

  it('detects superposed duplicates by signature', () => {
    const set: CadEntitySet = {
      ...cleanSet(),
      entities: [
        poly('WALLS', true, 'sig-a'),
        poly('WALLS', true, 'sig-a'), // duplicate
        poly('WALLS', true, 'sig-b'),
      ],
    };
    const report = qualifyCad(set);
    expect(report.duplicateOverlapCount).toBe(1);
    expect(report.reasons.some((r) => r.includes('double'))).toBe(true);
  });

  it('honours a configurable threshold', () => {
    const set = cleanSet();
    // A perfect file scores 1.0; a threshold above 1 forces manual tracing.
    const report = qualifyCad(set, { extractionThreshold: 1.01 });
    expect(report.recommendation).toBe('manual_tracing');
  });

  it('reports the number of levels present', () => {
    const report = qualifyCad({ ...cleanSet(), levelCount: 4 });
    expect(report.levelCount).toBe(4);
  });

  it('handles an empty entity set without dividing by zero', () => {
    const report = qualifyCad({
      entities: [],
      layers: [],
      declaredUnit: null,
      missingXrefs: [],
      levelCount: 0,
    });
    expect(report.closedPolylineRatio).toBe(0);
    expect(report.exploitableLayerRate).toBe(0);
    expect(report.recommendation).toBe('manual_tracing');
  });

  it('is deterministic', () => {
    const set = cleanSet();
    expect(qualifyCad(set)).toStrictEqual(qualifyCad(set));
  });
});
