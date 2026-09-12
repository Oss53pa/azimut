import { describe, it, expect } from 'vitest';
import {
  guardExportExcludesSketch,
  isSketchCollection,
  SKETCH_COLLECTIONS,
} from '../sketch-export.js';

describe('J3.3 — guardExportExcludesSketch', () => {
  it('passes when no sketch collection is included', () => {
    const r = guardExportExcludesSketch(['support', 'face', 'proof']);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toBeNull();
    expect(r.warnings).toEqual([]);
  });

  it('passes for an empty export (no-op)', () => {
    expect(guardExportExcludesSketch([]).ok).toBe(true);
  });

  it('blocks an export that includes sketch_layer', () => {
    const r = guardExportExcludesSketch(['face', 'sketch_layer']);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings[0]?.code).toBe('SKETCH.IN_DELIVERABLE');
    expect(r.findings[0]?.severity).toBe('blocking');
    expect(r.findings[0]?.ruleRef).toBe('J3.3');
    expect(r.findings[0]?.params['collection']).toBe('sketch_layer');
  });

  it('blocks an export that includes sketch_stroke', () => {
    const r = guardExportExcludesSketch(['sketch_stroke']);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings[0]?.params['collection']).toBe('sketch_stroke');
  });

  it('reports one finding per sketch collection in fixed order', () => {
    // input order reversed to prove output follows SKETCH_COLLECTIONS order
    const r = guardExportExcludesSketch(['sketch_stroke', 'face', 'sketch_layer']);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings.map((f) => f.params['collection'])).toEqual([
      'sketch_layer',
      'sketch_stroke',
    ]);
  });

  it('is deterministic across calls', () => {
    const a = guardExportExcludesSketch(['sketch_stroke', 'sketch_layer']);
    const b = guardExportExcludesSketch(['sketch_layer', 'sketch_stroke']);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('J3.4 — isSketchCollection', () => {
  it('is true for every declared sketch collection', () => {
    for (const name of SKETCH_COLLECTIONS) {
      expect(isSketchCollection(name)).toBe(true);
    }
  });

  it('is false for a non-sketch collection', () => {
    expect(isSketchCollection('face')).toBe(false);
    expect(isSketchCollection('support')).toBe(false);
    expect(isSketchCollection('')).toBe(false);
  });
});
