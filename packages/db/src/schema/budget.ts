import { uuid, text, timestamp, bigint, char, date, index } from 'drizzle-orm/pg-core';
import { azimut } from './azimut.js';
import { organization } from './org.js';
import { site } from './site.js';
import { fabricationLot } from './worksite.js';

/**
 * H8 — les tables du module 09, budget.
 *
 * Migration `0043` (famille C de la proposition de schéma, 5.5). Montants en
 * unité mineure entière avec leur devise ; un coût absent reste NULL.
 */

export const costReference = azimut.table('cost_reference', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  typology_key: text('typology_key').notNull(),
  substrate_key: text('substrate_key').notNull(),
  manufacturer_name: text('manufacturer_name'),
  unit_cost_minor: bigint('unit_cost_minor', { mode: 'number' }),
  currency: char('currency', { length: 3 }),
  since: date('since'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_cost_reference_org').on(t.org_id),
]);

export const budgetLine = azimut.table('budget_line', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  site_id: uuid('site_id').notNull().references(() => site.id, { onDelete: 'restrict' }),
  phase_key: text('phase_key').notNull(),
  lot_id: uuid('lot_id').references(() => fabricationLot.id, { onDelete: 'restrict' }),
  estimated_minor: bigint('estimated_minor', { mode: 'number' }),
  quoted_minor: bigint('quoted_minor', { mode: 'number' }),
  actual_minor: bigint('actual_minor', { mode: 'number' }),
  currency: char('currency', { length: 3 }).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_budget_line_org').on(t.org_id),
  index('idx_budget_line_site').on(t.site_id),
]);
