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

  it('exact-fit block does not overflow', () => {
    const tpl = validTemplate();
    const fit: Template = {
      ...tpl,
      blocks: [{
        index: 0,
        kind: 'resolved',
        binding: { source: 'route', field: 'x' },
        area: { col: 10, colSpan: 3, row: 1 }, // endCol = 12 === columns
      }],
    };
    const errors = validateTemplate(fit);
    expect(errors).toEqual([]);
  });

  it('one-past-boundary block overflows', () => {
    const tpl = validTemplate();
    const over: Template = {
      ...tpl,
      blocks: [{
        index: 0,
        kind: 'resolved',
        binding: { source: 'route', field: 'x' },
        area: { col: 10, colSpan: 4, row: 1 }, // endCol = 13 > 12
      }],
    };
    const errors = validateTemplate(over);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.block_index).toBe(0);
  });

  it('non-free pictogram without binding is rejected', () => {
    const tpl = validTemplate();
    const noBind: Template = {
      ...tpl,
      blocks: [{
        index: 0,
        kind: 'pictogram',
        area: { col: 1, colSpan: 6, row: 1 },
      }],
    };
    const errors = validateTemplate(noBind);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toContain("'pictogram'");
  });

  it('non-free map without binding is rejected', () => {
    const tpl = validTemplate();
    const noBind: Template = {
      ...tpl,
      blocks: [{
        index: 0,
        kind: 'map',
        area: { col: 1, colSpan: 6, row: 1 },
      }],
    };
    const errors = validateTemplate(noBind);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toContain("'map'");
  });

  it('free block with binding is accepted', () => {
    const tpl = validTemplate();
    const freeBind: Template = {
      ...tpl,
      blocks: [{
        index: 0,
        kind: 'free',
        binding: { source: 'route', field: 'x' },
        area: { col: 1, colSpan: 6, row: 1 },
      }],
    };
    const errors = validateTemplate(freeBind);
    expect(errors).toEqual([]);
  });

  it('same block can produce overflow AND missing-binding', () => {
    const tpl = validTemplate();
    const both: Template = {
      ...tpl,
      blocks: [{
        index: 0,
        kind: 'legend',
        area: { col: 10, colSpan: 5, row: 1 }, // overflow + no binding
      }],
    };
    const errors = validateTemplate(both);
    expect(errors).toHaveLength(2);
    expect(errors.some((e) => e.message.includes('overflows'))).toBe(true);
    expect(errors.some((e) => e.message.includes('binding'))).toBe(true);
  });

  it('duplicate-index error uses block_index -1', () => {
    const tpl = validTemplate();
    const dupes: Template = {
      ...tpl,
      blocks: [
        { index: 5, kind: 'free', area: { col: 1, colSpan: 3, row: 1 } },
        { index: 5, kind: 'free', area: { col: 4, colSpan: 3, row: 1 } },
      ],
    };
    const errors = validateTemplate(dupes);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.block_index).toBe(-1);
  });

  it('3+ blocks with same index still produces one duplicate error', () => {
    const tpl = validTemplate();
    const dupes: Template = {
      ...tpl,
      blocks: [
        { index: 0, kind: 'free', area: { col: 1, colSpan: 4, row: 1 } },
        { index: 0, kind: 'free', area: { col: 5, colSpan: 4, row: 1 } },
        { index: 0, kind: 'free', area: { col: 9, colSpan: 4, row: 1 } },
      ],
    };
    const errors = validateTemplate(dupes);
    const dupErrors = errors.filter((e) => e.message.includes('duplicate'));
    expect(dupErrors).toHaveLength(1);
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
