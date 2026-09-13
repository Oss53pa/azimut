import { describe, it, expect } from 'vitest';
import type { Template } from '@azimut/core-model';
import { guardTemplateBlockOverflow } from '../template-overflow.js';

function template(
  blocks: { index: number; col: number; colSpan: number }[],
  columns = 12,
): Template {
  return {
    key: 'totem',
    faceCount: 1,
    grid: { columns, margin_mm: 10, gutter_mm: 4 },
    blocks: blocks.map((b) => ({
      index: b.index,
      kind: 'free' as const,
      area: { col: b.col, colSpan: b.colSpan, row: 1 },
    })),
    sizing: { mode: 'computed' as const },
  };
}

describe('E10 — guardTemplateBlockOverflow (EDIT.TEMPLATE_BLOCK_OVERFLOW)', () => {
  it('accepts a template whose blocks fit the grid', () => {
    const r = guardTemplateBlockOverflow(
      template([
        { index: 0, col: 1, colSpan: 6 },
        { index: 1, col: 7, colSpan: 6 },
      ]),
    );
    expect(r.ok).toBe(true);
  });

  it('accepts a block ending exactly on the last column', () => {
    const r = guardTemplateBlockOverflow(template([{ index: 0, col: 1, colSpan: 12 }]));
    expect(r.ok).toBe(true);
  });

  it('blocks a block overflowing the grid columns', () => {
    const r = guardTemplateBlockOverflow(template([{ index: 0, col: 8, colSpan: 6 }]));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings[0]?.code).toBe('EDIT.TEMPLATE_BLOCK_OVERFLOW');
    expect(r.findings[0]?.severity).toBe('blocking');
    expect(r.findings[0]?.ruleRef).toBe('E10');
    expect(r.findings[0]?.params['last_col']).toBe(13);
    expect(r.findings[0]?.params['columns']).toBe(12);
    expect(r.findings[0]?.entity).toEqual({ kind: 'template_block', id: 'totem#0' });
  });

  it('reports overflowing blocks in index order', () => {
    const r = guardTemplateBlockOverflow(
      template([
        { index: 2, col: 10, colSpan: 5 },
        { index: 0, col: 1, colSpan: 4 },
        { index: 1, col: 11, colSpan: 4 },
      ]),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings.map((f) => f.params['block_index'])).toEqual([1, 2]);
  });
});
