import { uuid, text, timestamp, boolean, numeric, jsonb, index } from 'drizzle-orm/pg-core';
import { azimut } from './azimut.js';
import { organization } from './org.js';
import { site, level } from './site.js';

/**
 * J3.4 — la couche d'esquisse (migration 0072). Elle n'entre dans aucun calcul
 * ni aucun livrable (J3.3) : aucun chargeur de site ne la lit.
 */
export const sketchLayer = azimut.table('sketch_layer', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  site_id: uuid('site_id').notNull().references(() => site.id, { onDelete: 'restrict' }),
  level_id: uuid('level_id').notNull().references(() => level.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  owner_id: uuid('owner_id').notNull(),
  visible: boolean('visible').notNull().default(true),
  locked: boolean('locked').notNull().default(false),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  index('idx_sketch_layer_org').on(t.org_id),
  index('idx_sketch_layer_level').on(t.level_id),
]);

export const sketchStroke = azimut.table('sketch_stroke', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  layer_id: uuid('layer_id').notNull().references(() => sketchLayer.id, { onDelete: 'restrict' }),
  tool: text('tool').notNull(),
  color: text('color').notNull(),
  width_base_m: numeric('width_base_m').notNull(),
  points: jsonb('points').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  index('idx_sketch_stroke_org').on(t.org_id),
  index('idx_sketch_stroke_layer').on(t.layer_id),
]);
