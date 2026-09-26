import { describe, it, expect } from 'vitest';
import { templateSchema } from '../template-schema.js';
import { validTemplate } from './template-fixtures.js';

describe('D8.2 — templateSchema', () => {
  it('parses the spec example', () => {
    const tpl = validTemplate();
    expect(tpl.key).toBe('directional-suspended-2lines');
    expect(tpl.faceCount).toBe(2);
    expect(tpl.grid.columns).toBe(12);
    expect(tpl.blocks).toHaveLength(2);
    expect(tpl.sizing.mode).toBe('computed');
  });

  it('defaults sizing.mode to computed', () => {
    const tpl = templateSchema.parse({
      key: 'test',
      faceCount: 1,
      grid: { columns: 6, margin_mm: 10, gutter_mm: 5 },
      blocks: [],
    });
    expect(tpl.sizing.mode).toBe('computed');
  });

  it('rejects empty key', () => {
    expect(() => templateSchema.parse({
      key: '',
      faceCount: 1,
      grid: { columns: 6, margin_mm: 10, gutter_mm: 5 },
      blocks: [],
    })).toThrow();
  });

  it('rejects invalid block kind', () => {
    expect(() => templateSchema.parse({
      key: 'test',
      faceCount: 1,
      grid: { columns: 6, margin_mm: 10, gutter_mm: 5 },
      blocks: [{
        index: 0,
        kind: 'invalid',
        area: { col: 1, colSpan: 3, row: 1 },
      }],
    })).toThrow();
  });

  it('accepts all valid block kinds (D8.3)', () => {
    const kinds = ['resolved', 'free', 'pictogram', 'map', 'legend'] as const;
    for (const kind of kinds) {
      const tpl = templateSchema.parse({
        key: `test-${kind}`,
        faceCount: 1,
        grid: { columns: 6, margin_mm: 0, gutter_mm: 0 },
        blocks: [{
          index: 0,
          kind,
          binding: kind !== 'free'
            ? { source: 'route', field: 'x' }
            : undefined,
          area: { col: 1, colSpan: 6, row: 1 },
        }],
      });
      expect(tpl.blocks[0]?.kind).toBe(kind);
    }
  });
});

describe('D8.2 — templateSchema boundaries', () => {
  it.each([
    ['faceCount: 0', { key: 'test', faceCount: 0, grid: { columns: 6, margin_mm: 0, gutter_mm: 0 }, blocks: [] }],
    ['columns: 0', { key: 'test', faceCount: 1, grid: { columns: 0, margin_mm: 0, gutter_mm: 0 }, blocks: [] }],
    ['negative margin_mm', { key: 'test', faceCount: 1, grid: { columns: 6, margin_mm: -1, gutter_mm: 0 }, blocks: [] }],
  ] as const)('rejects %s', (_label, input) => {
    expect(() => templateSchema.parse(input)).toThrow();
  });

  it('rejects area.col: 0', () => {
    expect(() => templateSchema.parse({
      key: 'test', faceCount: 1,
      grid: { columns: 6, margin_mm: 0, gutter_mm: 0 },
      blocks: [{ index: 0, kind: 'free', area: { col: 0, colSpan: 1, row: 1 } }],
    })).toThrow();
  });

  it('rejects block index: -1', () => {
    expect(() => templateSchema.parse({
      key: 'test', faceCount: 1,
      grid: { columns: 6, margin_mm: 0, gutter_mm: 0 },
      blocks: [{ index: -1, kind: 'free', area: { col: 1, colSpan: 1, row: 1 } }],
    })).toThrow();
  });

  it('accepts sizing mode fixed', () => {
    const tpl = templateSchema.parse({
      key: 'test', faceCount: 1,
      grid: { columns: 6, margin_mm: 0, gutter_mm: 0 },
      blocks: [],
      sizing: { mode: 'fixed' },
    });
    expect(tpl.sizing.mode).toBe('fixed');
  });

  it('accepts growAxis height', () => {
    const tpl = templateSchema.parse({
      key: 'test', faceCount: 1,
      grid: { columns: 6, margin_mm: 0, gutter_mm: 0 },
      blocks: [],
      sizing: { mode: 'computed', growAxis: 'height' },
    });
    expect(tpl.sizing.growAxis).toBe('height');
  });

  it('rejects binding with empty source', () => {
    expect(() => templateSchema.parse({
      key: 'test', faceCount: 1,
      grid: { columns: 6, margin_mm: 0, gutter_mm: 0 },
      blocks: [{
        index: 0, kind: 'resolved',
        binding: { source: '', field: 'x' },
        area: { col: 1, colSpan: 1, row: 1 },
      }],
    })).toThrow();
  });

  it('rejects binding.limit: 0', () => {
    expect(() => templateSchema.parse({
      key: 'test', faceCount: 1,
      grid: { columns: 6, margin_mm: 0, gutter_mm: 0 },
      blocks: [{
        index: 0, kind: 'resolved',
        binding: { source: 'route', field: 'x', limit: 0 },
        area: { col: 1, colSpan: 1, row: 1 },
      }],
    })).toThrow();
  });

  it('rejects empty binding.field', () => {
    expect(() => templateSchema.parse({
      key: 'test', faceCount: 1,
      grid: { columns: 6, margin_mm: 0, gutter_mm: 0 },
      blocks: [{ index: 0, kind: 'resolved', binding: { source: 'route', field: '' }, area: { col: 1, colSpan: 1, row: 1 } }],
    })).toThrow();
  });

  it('rejects negative gutter_mm', () => {
    expect(() => templateSchema.parse({
      key: 'test', faceCount: 1,
      grid: { columns: 6, margin_mm: 0, gutter_mm: -1 },
      blocks: [],
    })).toThrow();
  });

  it('rejects area.colSpan: 0', () => {
    expect(() => templateSchema.parse({
      key: 'test', faceCount: 1,
      grid: { columns: 6, margin_mm: 0, gutter_mm: 0 },
      blocks: [{ index: 0, kind: 'free', area: { col: 1, colSpan: 0, row: 1 } }],
    })).toThrow();
  });
});
