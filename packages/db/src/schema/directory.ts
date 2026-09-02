import { uuid, text, timestamp, integer, jsonb, boolean, numeric, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { azimut } from './azimut.js';
import { organization } from './org.js';
import { site } from './site.js';
import { footprint } from './site.js';
import { node } from './graph.js';

export const category = azimut.table('category', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  sector_key: text('sector_key').notNull(),
  code: text('code').notNull(),
  parent_id: uuid('parent_id'),
}, (t) => [
  index('idx_category_org').on(t.org_id),
]);

export const pictogram = azimut.table('pictogram', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  category_id: uuid('category_id').notNull().references(() => category.id, { onDelete: 'cascade' }),
  source: text('source').notNull(),
  standard_ref: text('standard_ref').notNull(),
  svg_path: text('svg_path').notNull(),
  registry: text('registry').notNull(),
}, (t) => [
  index('idx_pictogram_org').on(t.org_id),
]);

export const destination = azimut.table('destination', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  footprint_id: uuid('footprint_id').notNull().references(() => footprint.id, { onDelete: 'cascade' }),
  node_id: uuid('node_id').notNull().references(() => node.id, { onDelete: 'cascade' }),
  category_id: uuid('category_id').notNull().references(() => category.id, { onDelete: 'cascade' }),
  occupant_name: text('occupant_name').notNull().default(''),
  occupancy_status: text('occupancy_status').notNull().default('vacant'),
  display_priority: integer('display_priority').notNull().default(0),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_destination_org').on(t.org_id),
]);

export const destinationName = azimut.table('destination_name', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  destination_id: uuid('destination_id').notNull().references(() => destination.id, { onDelete: 'cascade' }),
  lang: text('lang').notNull(),
  value: text('value').notNull(),
}, (t) => [
  uniqueIndex('destination_name_dest_lang').on(t.destination_id, t.lang),
  index('idx_destination_name_org').on(t.org_id),
]);

export const travelProfile = azimut.table('travel_profile', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  site_id: uuid('site_id').notNull().references(() => site.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  name: text('name').notNull(),
  excluded_edge_kinds: jsonb('excluded_edge_kinds').notNull().default([]),
  weights: jsonb('weights'),
  require_accessible: boolean('require_accessible').notNull().default(false),
  honor_hours: boolean('honor_hours').notNull().default(false),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_travel_profile_org').on(t.org_id),
]);

export const routeCache = azimut.table('route_cache', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  site_id: uuid('site_id').notNull().references(() => site.id, { onDelete: 'cascade' }),
  profile_id: uuid('profile_id').notNull().references(() => travelProfile.id, { onDelete: 'cascade' }),
  from_node_id: uuid('from_node_id').notNull().references(() => node.id, { onDelete: 'cascade' }),
  to_node_id: uuid('to_node_id').notNull().references(() => node.id, { onDelete: 'cascade' }),
  path: jsonb('path').notNull(),
  cost: numeric('cost').notNull(),
  computed_at: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  inputs_hash: text('inputs_hash').notNull(),
}, (t) => [
  index('idx_route_cache_org').on(t.org_id),
]);

export const decisionPoint = azimut.table('decision_point', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  site_id: uuid('site_id').notNull().references(() => site.id, { onDelete: 'cascade' }),
  profile_id: uuid('profile_id').notNull().references(() => travelProfile.id, { onDelete: 'cascade' }),
  node_id: uuid('node_id').notNull().references(() => node.id, { onDelete: 'cascade' }),
  branch_count: integer('branch_count').notNull(),
  computed_at: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_decision_point_org').on(t.org_id),
]);
