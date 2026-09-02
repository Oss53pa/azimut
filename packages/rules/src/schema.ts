import { z } from 'zod';

const nonEmpty = z.string().min(1);

export const rulesPackRuleSchema = z.object({
  code: nonEmpty,
  scope: nonEmpty,
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  source_ref: nonEmpty,
});

export const rulesPackSchema = z.object({
  key: nonEmpty,
  version: nonEmpty,
  jurisdiction: nonEmpty,
  effective_from: nonEmpty,
  source_ref: nonEmpty,
  rules: z.array(rulesPackRuleSchema).min(1),
});

export type RulesPackRule = z.infer<typeof rulesPackRuleSchema>;
export type RulesPackFile = z.infer<typeof rulesPackSchema>;
