import type { Finding, Outcome, Template } from '@azimut/core-model';

/**
 * E10 — Template (gabarit) editing, context 2. Saving a template a block of
 * which overflows the grid is refused, with the dedicated code. A block spans
 * columns from `col` over `colSpan`; it overflows when its last column exceeds
 * the grid's column count. This guard is that save-time control, raising a
 * blocking EDIT.TEMPLATE_BLOCK_OVERFLOW per overflowing block.
 *
 * validateTemplate reports the same overflow as a message for the schema layer;
 * this guard produces the catalogued anomaly the save path needs.
 */
export function guardTemplateBlockOverflow(template: Template): Outcome<null> {
  const findings: Finding[] = [];
  const blocks = [...template.blocks].sort((a, b) => a.index - b.index);

  for (const block of blocks) {
    const lastCol = block.area.col + block.area.colSpan - 1;
    if (lastCol > template.grid.columns) {
      findings.push({
        code: 'EDIT.TEMPLATE_BLOCK_OVERFLOW',
        severity: 'blocking',
        entity: { kind: 'template_block', id: `${template.key}#${block.index}` },
        params: {
          block_index: block.index,
          last_col: lastCol,
          columns: template.grid.columns,
        },
        ruleRef: 'E10',
      });
    }
  }

  if (findings.length > 0) {
    return { ok: false, findings };
  }
  return { ok: true, value: null, warnings: [] };
}
