import { uuid, text, timestamp, integer, numeric, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { azimut } from './azimut.js';
import { organization } from './org.js';
import { site } from './site.js';

export const charter = azimut.table('charter', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  site_id: uuid('site_id').notNull().references(() => site.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  version: text('version').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_charter_org').on(t.org_id),
]);

export const charterColor = azimut.table('charter_color', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  charter_id: uuid('charter_id').notNull().references(() => charter.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  hex: text('hex').notNull(),
  usage: text('usage').notNull(),
}, (t) => [
  index('idx_charter_color_org').on(t.org_id),
]);

export const charterTypeface = azimut.table('charter_typeface', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  charter_id: uuid('charter_id').notNull().references(() => charter.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  family: text('family').notNull(),
  weight: integer('weight').notNull(),
  min_size_mm: numeric('min_size_mm').notNull(),
}, (t) => [
  index('idx_charter_typeface_org').on(t.org_id),
]);

export const charterRule = azimut.table('charter_rule', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  charter_id: uuid('charter_id').notNull().references(() => charter.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  params: jsonb('params').notNull().default({}),
}, (t) => [
  index('idx_charter_rule_org').on(t.org_id),
]);

export const lexiconTerm = azimut.table('lexicon_term', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  charter_id: uuid('charter_id').notNull().references(() => charter.id, { onDelete: 'cascade' }),
  lang: text('lang').notNull(),
  term: text('term').notNull(),
  severity: text('severity').notNull(),
}, (t) => [
  index('idx_lexicon_term_org').on(t.org_id),
]);

export const rulesPack = azimut.table('rules_pack', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull(),
  version: text('version').notNull(),
  jurisdiction: text('jurisdiction').notNull(),
  effective_from: text('effective_from').notNull(),
  source_ref: text('source_ref').notNull(),
  checksum: text('checksum').notNull(),
}, (t) => [
  uniqueIndex('rules_pack_key_version').on(t.key, t.version),
]);

export const rulesPackRule = azimut.table('rules_pack_rule', {
  id: uuid('id').primaryKey().defaultRandom(),
  rules_pack_id: uuid('rules_pack_id').notNull().references(() => rulesPack.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  scope: text('scope').notNull(),
  params: jsonb('params').notNull().default({}),
  source_ref: text('source_ref').notNull(),
}, (t) => [
  index('idx_rules_pack_rule_pack').on(t.rules_pack_id),
]);

export const siteRulesBinding = azimut.table('site_rules_binding', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  site_id: uuid('site_id').notNull().references(() => site.id, { onDelete: 'cascade' }),
  rules_pack_id: uuid('rules_pack_id').notNull().references(() => rulesPack.id, { onDelete: 'cascade' }),
  bound_at: timestamp('bound_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_site_rules_binding_org').on(t.org_id),
]);
