import { uuid, text, timestamp, integer, numeric, boolean, jsonb, index } from 'drizzle-orm/pg-core';
import { azimut } from './azimut.js';
import { organization } from './org.js';
import { site, level, building } from './site.js';

export const node = azimut.table('node', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  level_id: uuid('level_id').notNull().references(() => level.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  position: jsonb('position').notNull(),
  label: text('label').notNull().default(''),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_node_org').on(t.org_id),
  index('idx_node_level').on(t.level_id),
]);

export const edge = azimut.table('edge', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  from_node_id: uuid('from_node_id').notNull().references(() => node.id, { onDelete: 'cascade' }),
  to_node_id: uuid('to_node_id').notNull().references(() => node.id, { onDelete: 'cascade' }),
  width_m: numeric('width_m').notNull(),
  slope_pct: numeric('slope_pct').notNull().default('0'),
  accessible: boolean('accessible').notNull().default(true),
  direction: text('direction').notNull().default('both'),
  availability: jsonb('availability'),
  evacuation_route: boolean('evacuation_route').notNull().default(false),
  length_m: numeric('length_m').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_edge_org').on(t.org_id),
  index('idx_edge_from').on(t.from_node_id),
  index('idx_edge_to').on(t.to_node_id),
]);

export const verticalLink = azimut.table('vertical_link', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  edge_id: uuid('edge_id').notNull().references(() => edge.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  capacity: integer('capacity').notNull().default(1),
  accessible: boolean('accessible').notNull().default(true),
}, (t) => [
  index('idx_vertical_link_org').on(t.org_id),
]);

export const buildingLink = azimut.table('building_link', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  edge_id: uuid('edge_id').notNull().references(() => edge.id, { onDelete: 'cascade' }),
  from_building_id: uuid('from_building_id').notNull().references(() => building.id, { onDelete: 'cascade' }),
  to_building_id: uuid('to_building_id').notNull().references(() => building.id, { onDelete: 'cascade' }),
  sheltered: boolean('sheltered').notNull().default(false),
}, (t) => [
  index('idx_building_link_org').on(t.org_id),
]);

/**
 * O11 — fermeture temporaire d'une ou plusieurs arêtes (migration 0069).
 * Bornes en heure locale du site (O4), sans fuseau ; fin incluse.
 */
export const temporaryClosure = azimut.table('temporary_closure', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  site_id: uuid('site_id').notNull().references(() => site.id, { onDelete: 'restrict' }),
  edge_ids: jsonb('edge_ids').notNull(),
  // Chaîne, pas `Date` : un instant local n'a pas de fuseau à convertir.
  from_at: timestamp('from_at', { withTimezone: false, mode: 'string' }).notNull(),
  to_at: timestamp('to_at', { withTimezone: false, mode: 'string' }).notNull(),
  reason: text('reason').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_temporary_closure_org').on(t.org_id),
  index('idx_temporary_closure_site').on(t.site_id),
]);
