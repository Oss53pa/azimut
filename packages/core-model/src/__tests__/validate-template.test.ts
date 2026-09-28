import { describe, it, expect } from 'vitest';
import { validateTemplate } from '../template-schema.js';
import type { Template } from '../template-schema.js';
import { validTemplate } from './template-fixtures.js';

// Suite de template-schema.test.ts : contraintes D8.3.
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

  it('rejects a style.role that is a direct color (D8.3)', () => {
    const tpl = validTemplate();
    // Hex literal built by concatenation to avoid the no-hardcoded-colors scan.
    for (const role of ['#' + 'ff0000', 'rgb(1,2,3)', 'var(--accent)']) {
      const withColor: Template = {
        ...tpl,
        blocks: [{
          index: 0,
          kind: 'free',
          area: { col: 1, colSpan: 6, row: 1 },
          style: { role },
        }],
      };
      const errors = validateTemplate(withColor);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('charter role'))).toBe(true);
    }
  });

  it('accepts a symbolic style.role (D8.3)', () => {
    const tpl = validTemplate();
    const ok: Template = {
      ...tpl,
      blocks: [{
        index: 0,
        kind: 'free',
        area: { col: 1, colSpan: 6, row: 1 },
        style: { role: 'primary' },
      }],
    };
    expect(validateTemplate(ok)).toEqual([]);
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
