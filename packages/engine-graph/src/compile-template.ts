import type {
  Template,
  TemplateBlock,
  FaceTemplate,
  ContentBlockDef,
  ContentBlockKind,
  Outcome,
  Finding,
} from '@azimut/core-model';
import { validateTemplate } from '@azimut/core-model';

/**
 * D8 — Template compiler.
 *
 * The D8 `Template` (grid + declarative blocks) is the authoritative authoring
 * format. This compiler turns a Template into the engine's `FaceTemplate`,
 * which the `composeFace` → `renderFace` pipeline consumes; since H2.5 the
 * content itself comes from the message schedule, not straight from the graph.
 * Adding a template is therefore pure data (D8.1): author a Template as JSON,
 * compile it, and it renders — no engine code changes (proven by the D8.4 test).
 *
 * Grid → region mapping (documented decision, since D8.2 `area` carries only
 * col/colSpan/row):
 *   - Rows are inferred as max(area.row); each block occupies exactly one row
 *     (there is no rowSpan in the schema); row heights are uniform.
 *   - margin_mm and gutter_mm are converted to percentages of the face
 *     dimensions, so a block's region is expressed in the % coordinates the
 *     renderer already uses.
 */

export type FaceDimensions = {
  readonly width_mm: number;
  readonly height_mm: number;
};

type MappedBlock = {
  readonly kind: ContentBlockKind;
  readonly config: Record<string, unknown>;
};

/**
 * Map a D8 block (kind + binding) to a concrete engine content block. Returns
 * null when the binding is not part of the supported vocabulary.
 */
function mapBlock(block: TemplateBlock): MappedBlock | null {
  switch (block.kind) {
    case 'free':
      // D8.3: only free blocks carry typed text; the text is instance data,
      // not template data, so a compiled free block starts empty.
      return { kind: 'free_text', config: { text: '' } };
    case 'map':
      return { kind: 'map', config: {} };
    case 'legend':
      return { kind: 'legend', config: {} };
    case 'pictogram':
      return { kind: 'pictogram', config: {} };
    case 'resolved': {
      const b = block.binding;
      if (b === undefined) return null;
      if (b.source === 'route' && b.field === 'nextDestinations') {
        return {
          kind: 'destination_list',
          config: b.limit !== undefined ? { limit: b.limit } : {},
        };
      }
      if (b.source === 'site' && b.field === 'name') {
        return { kind: 'header', config: {} };
      }
      return null;
    }
  }
}

function layoutRegion(
  area: TemplateBlock['area'],
  grid: Template['grid'],
  dims: FaceDimensions,
  rowCount: number,
): ContentBlockDef['region'] {
  const marginX = (grid.margin_mm / dims.width_mm) * 100;
  const gutterX = (grid.gutter_mm / dims.width_mm) * 100;
  const colWidth =
    (100 - 2 * marginX - (grid.columns - 1) * gutterX) / grid.columns;
  const x = marginX + (area.col - 1) * (colWidth + gutterX);
  const w = area.colSpan * colWidth + (area.colSpan - 1) * gutterX;

  const marginY = (grid.margin_mm / dims.height_mm) * 100;
  const gutterY = (grid.gutter_mm / dims.height_mm) * 100;
  const rowHeight =
    (100 - 2 * marginY - (rowCount - 1) * gutterY) / rowCount;
  const y = marginY + (area.row - 1) * (rowHeight + gutterY);

  return { x_pct: x, y_pct: y, w_pct: w, h_pct: rowHeight };
}

function invalidFindings(
  template: Template,
  errors: ReturnType<typeof validateTemplate>,
): Finding[] {
  return errors.map((e) => ({
    code: 'LAYOUT.TEMPLATE_INVALID',
    severity: 'blocking',
    entity: null,
    params: {
      template_key: template.key,
      block_index: e.block_index,
      message: e.message,
    },
    ruleRef: null,
  }));
}

/**
 * Compile a validated D8 Template into a FaceTemplate for the given face
 * dimensions. Fails (never falls back) on validation errors or unsupported
 * bindings.
 */
export function compileTemplate(
  template: Template,
  dims: FaceDimensions,
): Outcome<FaceTemplate> {
  const errors = validateTemplate(template);
  if (errors.length > 0) {
    return { ok: false, findings: invalidFindings(template, errors) };
  }

  const rowCount = template.blocks.reduce(
    (max, b) => Math.max(max, b.area.row),
    1,
  );

  const sorted = [...template.blocks].sort((a, b) => a.index - b.index);
  const blocks: ContentBlockDef[] = [];
  const findings: Finding[] = [];

  for (const block of sorted) {
    const mapped = mapBlock(block);
    if (mapped === null) {
      findings.push({
        code: 'LAYOUT.TEMPLATE_BINDING_UNSUPPORTED',
        severity: 'blocking',
        entity: null,
        params: {
          template_key: template.key,
          block_index: block.index,
          source: block.binding?.source ?? '',
          field: block.binding?.field ?? '',
        },
        ruleRef: null,
      });
      continue;
    }
    blocks.push({
      kind: mapped.kind,
      ordinal: block.index,
      region: layoutRegion(block.area, template.grid, dims, rowCount),
      config: mapped.config,
    });
  }

  if (findings.length > 0) return { ok: false, findings };

  return {
    ok: true,
    value: {
      id: template.key,
      org_id: '',
      support_type_key: '',
      side: '',
      name: template.key,
      blocks,
    },
    warnings: [],
  };
}
