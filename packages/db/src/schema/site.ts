import { uuid, text, timestamp, integer, numeric, boolean, jsonb, index } from 'drizzle-orm/pg-core';
import { azimut } from './azimut.js';
import { organization } from './org.js';

export const site = azimut.table('site', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  country_code: text('country_code').notNull(),
  rules_pack_id: uuid('rules_pack_id'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  index('idx_site_org').on(t.org_id),
]);

export const building = azimut.table('building', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  site_id: uuid('site_id').notNull().references(() => site.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  independent_access: boolean('independent_access').notNull().default(false),
  opening_hours: jsonb('opening_hours'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_building_org').on(t.org_id),
  index('idx_building_site').on(t.site_id),
]);

export const level = azimut.table('level', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  building_id: uuid('building_id').notNull().references(() => building.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  ordinal: integer('ordinal').notNull(),
  elevation_m: numeric('elevation_m').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_level_org').on(t.org_id),
  index('idx_level_building').on(t.building_id),
]);

export const footprint = azimut.table('footprint', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  level_id: uuid('level_id').notNull().references(() => level.id, { onDelete: 'cascade' }),
  geometry: jsonb('geometry').notNull(),
  kind: text('kind').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_footprint_org').on(t.org_id),
]);

export const volume = azimut.table('volume', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  footprint_id: uuid('footprint_id').notNull().references(() => footprint.id, { onDelete: 'cascade' }),
  base_elevation_m: numeric('base_elevation_m').notNull(),
  height_m: numeric('height_m').notNull(),
  material_key: text('material_key').notNull(),
}, (t) => [
  index('idx_volume_org').on(t.org_id),
]);

export const zone = azimut.table('zone', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  level_id: uuid('level_id').notNull().references(() => level.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_zone_org').on(t.org_id),
]);

export const planSource = azimut.table('plan_source', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  level_id: uuid('level_id').notNull().references(() => level.id, { onDelete: 'cascade' }),
  storage_path: text('storage_path').notNull(),
  media_type: text('media_type').notNull(),
  uploaded_at: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_plan_source_org').on(t.org_id),
]);

export const planCalibration = azimut.table('plan_calibration', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  plan_source_id: uuid('plan_source_id').notNull().references(() => planSource.id, { onDelete: 'cascade' }),
  scale_m_per_px: numeric('scale_m_per_px').notNull(),
  origin_x: numeric('origin_x').notNull(),
  origin_y: numeric('origin_y').notNull(),
  rotation_deg: numeric('rotation_deg').notNull().default('0'),
}, (t) => [
  index('idx_plan_calibration_org').on(t.org_id),
]);

export const opening = azimut.table('opening', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  footprint_id: uuid('footprint_id').notNull().references(() => footprint.id, { onDelete: 'cascade' }),
  position: jsonb('position').notNull(),
  width_m: numeric('width_m').notNull(),
  kind: text('kind').notNull(),
}, (t) => [
  index('idx_opening_org').on(t.org_id),
]);
