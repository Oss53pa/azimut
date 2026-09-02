import { z } from 'zod';

const positiveInt = z.number().int().positive();

export const TEMPLATE_BLOCK_KINDS = [
  'resolved', 'free', 'pictogram', 'map', 'legend',
] as const;

export type TemplateBlockKind = (typeof TEMPLATE_BLOCK_KINDS)[number];

const bindingSchema = z.object({
  source: z.string().min(1),
  field: z.string().min(1),
  limit: positiveInt.optional(),
});

const areaSchema = z.object({
  col: positiveInt,
  colSpan: positiveInt,
  row: positiveInt,
});

const styleSchema = z.object({
  role: z.string().min(1),
  align: z.enum(['left', 'center', 'right']).optional(),
}).optional();

const blockSchema = z.object({
  index: z.number().int().min(0),
  kind: z.enum(TEMPLATE_BLOCK_KINDS),
  binding: bindingSchema.optional(),
  area: areaSchema,
  style: styleSchema,
});

const gridSchema = z.object({
  columns: positiveInt,
  margin_mm: z.number().min(0),
  gutter_mm: z.number().min(0),
});

const sizingSchema = z.object({
  mode: z.enum(['computed', 'fixed']).default('computed'),
  growAxis: z.enum(['width', 'height']).optional(),
});

export const templateSchema = z.object({
  key: z.string().min(1),
  faceCount: positiveInt,
  grid: gridSchema,
  blocks: z.array(blockSchema),
  sizing: sizingSchema.default({ mode: 'computed' }),
});

export type TemplateBlock = z.infer<typeof blockSchema>;
export type TemplateGrid = z.infer<typeof gridSchema>;
export type TemplateSizing = z.infer<typeof sizingSchema>;
export type Template = z.infer<typeof templateSchema>;

export type TemplateValidationError = {
  readonly block_index: number;
  readonly message: string;
};

export function validateTemplate(
  template: Template,
): readonly TemplateValidationError[] {
  const errors: TemplateValidationError[] = [];

  for (const block of template.blocks) {
    const endCol = block.area.col + block.area.colSpan - 1;
    if (endCol > template.grid.columns) {
      errors.push({
        block_index: block.index,
        message: `block overflows grid: col ${block.area.col} + span ${block.area.colSpan} > ${template.grid.columns} columns`,
      });
    }

    if (block.kind !== 'free' && block.binding === undefined) {
      errors.push({
        block_index: block.index,
        message: `non-free block '${block.kind}' requires a binding`,
      });
    }
  }

  const indices = template.blocks.map((b) => b.index);
  const uniqueIndices = new Set(indices);
  if (uniqueIndices.size !== indices.length) {
    errors.push({
      block_index: -1,
      message: 'duplicate block indices',
    });
  }

  return errors;
}
