import { z } from 'zod';

const nonEmpty = z.string().min(1);

export const ruleScopeSchema = z.object({
  supportRegistry: z.string().optional(),
  context: z.string().optional(),
  sectorKey: z.string().optional(),
}).default({});

export type RuleScope = z.infer<typeof ruleScopeSchema>;

export const rulesPackRuleSchema = z.object({
  code: nonEmpty,
  scope: ruleScopeSchema,
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  source_ref: nonEmpty,
});

export const rulesPackSchema = z.object({
  key: nonEmpty,
  version: nonEmpty,
  jurisdiction: nonEmpty,
  effective_from: nonEmpty,
  source_ref: nonEmpty,
  rules: z.array(rulesPackRuleSchema),
});

export type RulesPackRule = z.infer<typeof rulesPackRuleSchema>;
export type RulesPackFile = z.infer<typeof rulesPackSchema>;
