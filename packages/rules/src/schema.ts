import { z } from 'zod';

const nonEmpty = z.string().min(1);

export const ruleScopeSchema = z.object({
  supportRegistry: z.string().optional(),
  context: z.string().optional(),
  sectorKey: z.string().optional(),
}).default({});

export type RuleScope = z.infer<typeof ruleScopeSchema>;

/**
 * D3.6 — constraint direction for country-overlay comparison. `key` names the
 * param that carries the comparable value; `tighten` says which direction is
 * more constraining. A country rule that does not declare this cannot be
 * proven more constraining, so the overlay keeps the base (socle) rule.
 *   - higher       : a higher numeric value is stricter (e.g. minimum height).
 *   - lower        : a lower numeric value is stricter (e.g. maximum spacing).
 *   - boolean-true : requiring true is stricter than not requiring it.
 *   - boolean-false: requiring false is stricter than not requiring it.
 */
export const ruleConstraintSchema = z.object({
  key: nonEmpty,
  tighten: z.enum(['higher', 'lower', 'boolean-true', 'boolean-false']),
});

export type RuleConstraint = z.infer<typeof ruleConstraintSchema>;

export const rulesPackRuleSchema = z.object({
  code: nonEmpty,
  scope: ruleScopeSchema,
  kind: nonEmpty.optional(),
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  constraint: ruleConstraintSchema.optional(),
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
