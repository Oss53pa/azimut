import { text, boolean, numeric, uuid, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { organization } from './org.js';
import { azimut } from './azimut.js';

/**
 * D-4 : la liste blanche de `azimut.apply_commands` (migration 0078) : les
 * tables qu'une commande peut viser, leur module propriétaire et les
 * opérations permises. Écrite par les seules migrations.
 */
export const commandTable = azimut.table('command_table', {
  table_name: text('table_name').primaryKey(),
  modules: text('modules').array().notNull(),
  can_create: boolean('can_create').notNull(),
  can_update: boolean('can_update').notNull(),
  can_delete: boolean('can_delete').notNull(),
});

/**
 * D-5 : les seuils communs (migration 0081), écrits par les seules migrations.
 */
export const securitySetting = azimut.table('security_setting', {
  key: text('key').primaryKey(),
  value: numeric('value').notNull(),
  unit: text('unit').notNull(),
  org_overridable: boolean('org_overridable').notNull(),
  source_ref: text('source_ref').notNull(),
  description: text('description').notNull(),
});

/** D-5 : la surcharge d'une organisation, qui ne peut que resserrer. */
export const orgSecuritySetting = azimut.table('org_security_setting', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  key: text('key').notNull().references(() => securitySetting.key, { onDelete: 'restrict' }),
  value: numeric('value').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_org_security_setting_org').on(t.org_id),
  unique('org_security_setting_unique').on(t.org_id, t.key),
]);
