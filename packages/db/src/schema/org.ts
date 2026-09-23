import { uuid, text, timestamp, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { azimut } from './azimut.js';

export const organization = azimut.table('organization', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const membership = azimut.table('membership', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  user_id: uuid('user_id').notNull(),
  role: text('role').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('membership_org_user').on(t.org_id, t.user_id),
  index('idx_membership_org').on(t.org_id),
  index('idx_membership_user').on(t.user_id),
]);

/**
 * Q9 — le référentiel des pays.
 *
 * Table globale, sans `org_id` : elle ne se cloisonne pas, elle se lit. Q2 la
 * range à la plateforme, et M00.PL2 la veut en lecture seule pour
 * l'application, alimentée par fichier et migration. Sa source est
 * `src/reference/country.json`, versée par `pnpm seed:reference`.
 */
export const country = azimut.table('country', {
  code: text('code').primaryKey(),
  name_fr: text('name_fr').notNull(),
  name_en: text('name_en').notNull(),
  timezones: jsonb('timezones').notNull().default([]),
  default_currency_code: text('default_currency_code'),
  source_ref: text('source_ref').notNull(),
});
