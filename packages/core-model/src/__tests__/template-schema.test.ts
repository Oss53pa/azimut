import { describe, it, expect } from 'vitest';
import { templateSchema, validateTemplate } from '../template-schema.js';
import type { Template } from '../template-schema.js';

function validTemplate(overrides?: Partial<Template>): Template {
  return templateSchema.parse({
    key: 'directional-suspended-2lines',
    faceCount: 2,
    grid: { columns: 12, margin_mm: 40, gutter_mm: 20 },
    blocks: [
      {
        index: 0,
        kind: 'resolved',
        binding: { source: 'route', field: 'nextDestinations', limit: 4 },
        area: { col: 1, colSpan: 9, row: 1 },
        style: { role: 'primary', align: 'left' },
      },
      {
        index: 1,
        kind: 'pictogram',
        binding: { source: 'destination', field: 'pictogram' },
        area: { col: 10, colSpan: 3, row: 1 },
      },
    ],
    sizing: { mode: 'computed', growAxis: 'width' },
    ...overrides,
  });
}

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

describe('D8.3 — validateTemplate', () => {
  it('accepts a valid template', () => {
    const errors = validateTemplate(validTemplate());
    expect(errors).toEqual([]);
  });

  it('detects block overflow (D8.3)', () => {
    const tpl = validTemplate();
    const overflowing: Template = {
      ...tpl,
      blocks: [{
        index: 0,
        kind: 'resolved',
        binding: { source: 'route', field: 'x' },
        area: { col: 10, colSpan: 5, row: 1 },
      }],
    };
    const errors = validateTemplate(overflowing);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.message).toContain('overflows');
  });

  it('detects non-free block without binding', () => {
    const tpl = validTemplate();
    const noBinding: Template = {
      ...tpl,
      blocks: [{
        index: 0,
        kind: 'resolved',
        area: { col: 1, colSpan: 6, row: 1 },
      }],
    };
    const errors = validateTemplate(noBinding);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.message).toContain('binding');
  });

  it('allows free block without binding (D8.3)', () => {
    const tpl = validTemplate();
    const freeBlock: Template = {
      ...tpl,
      blocks: [{
        index: 0,
        kind: 'free',
        area: { col: 1, colSpan: 6, row: 1 },
      }],
    };
    const errors = validateTemplate(freeBlock);
    expect(errors).toEqual([]);
  });

  it('detects duplicate block indices', () => {
    const tpl = validTemplate();
    const dupes: Template = {
      ...tpl,
      blocks: [
        {
          index: 0,
          kind: 'free',
          area: { col: 1, colSpan: 6, row: 1 },
        },
        {
          index: 0,
          kind: 'free',
          area: { col: 1, colSpan: 6, row: 2 },
        },
      ],
    };
    const errors = validateTemplate(dupes);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.message).toContain('duplicate');
  });

  it('accepts a template with no blocks', () => {
    const tpl = validTemplate();
    const empty: Template = { ...tpl, blocks: [] };
    expect(validateTemplate(empty)).toEqual([]);
  });
});
