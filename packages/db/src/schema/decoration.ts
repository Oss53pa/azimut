import { uuid, text, timestamp, boolean, numeric, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { azimut } from './azimut.js';
import { organization } from './org.js';
import { site, level } from './site.js';

/**
 * E9.3, décisions Q6 et Q7 — l'habillage (migration 0086). La forme des
 * colonnes jsonb, le rattachement au site et le cloisonnement sont tenus par
 * la base ; ce fichier n'en décrit que les colonnes.
 */
export const decorationLayer = azimut.table('decoration_layer', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  site_id: uuid('site_id').notNull().references(() => site.id, { onDelete: 'restrict' }),
  level_id: uuid('level_id').notNull().references(() => level.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  z_order: integer('z_order').notNull().default(0),
  visible: boolean('visible').notNull().default(true),
  print_visible: boolean('print_visible').notNull().default(true),
  locked: boolean('locked').notNull().default(false),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('decoration_layer_level_idx').on(t.level_id),
  index('decoration_layer_site_idx').on(t.site_id),
]);

export const decorationShape = azimut.table('decoration_shape', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  layer_id: uuid('layer_id').notNull().references(() => decorationLayer.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  geometry: jsonb('geometry').notNull(),
  style_role: text('style_role'),
  label: text('label').notNull().default(''),
  rotation_deg: numeric('rotation_deg').notNull().default('0'),
  // Q6 — absentes d'E9.3, signalées à l'éditeur.
  z_order: integer('z_order').notNull().default(0),
  style: jsonb('style').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('decoration_shape_layer_idx').on(t.layer_id),
]);
