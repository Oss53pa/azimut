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
  kind: nonEmpty.optional(),
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  source_ref: nonEmpty,
  notes: z.string().optional(),
});

export const rulesPackSchema = z.object({
  key: nonEmpty,
  version: nonEmpty,
  jurisdiction: nonEmpty,
  effective_from: nonEmpty,
  source_ref: nonEmpty,
  rules: z.array(rulesPackRuleSchema),
});

export const manifestSchema = z.object({
  key: nonEmpty,
  version: nonEmpty,
  jurisdiction: nonEmpty,
  effective_from: nonEmpty,
  supersedes: z.string().nullable().optional(),
  files: z.array(nonEmpty).min(0),
  checksum: nonEmpty,
});

export const ruleFileSchema = z.array(rulesPackRuleSchema);

export type RulesPackRule = z.infer<typeof rulesPackRuleSchema>;
export type RulesPackFile = z.infer<typeof rulesPackSchema>;
export type Manifest = z.infer<typeof manifestSchema>;
export type RuleFileContent = z.infer<typeof ruleFileSchema>;
