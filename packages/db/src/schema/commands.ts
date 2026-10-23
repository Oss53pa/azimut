import { text, boolean } from 'drizzle-orm/pg-core';
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
