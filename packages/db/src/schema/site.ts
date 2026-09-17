import {
  uuid, text, timestamp, integer, numeric, boolean, jsonb, index,
} from 'drizzle-orm/pg-core';
import { azimut } from './azimut.js';
import { organization } from './org.js';

export const site = azimut.table('site', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  country_code: text('country_code').notNull(),
  rules_pack_id: uuid('rules_pack_id'),
  // S1 / D1.1 / N1.2 — origine du repère site, en mètres, recopiée du premier
  // calage et jamais modifiée. Nullable : tant qu'aucun calage n'a eu lieu, le
  // repère n'est pas posé, et ce n'est pas l'origine (0, 0).
  origin_x: numeric('origin_x'),
  origin_y: numeric('origin_y'),
  // N1.2 — langues actives. Nullable : une ligne antérieure à la migration
  // n'en déclare aucune, et la migration ne va pas en déclarer à sa place.
  // Le CHECK interdit en revanche le tableau vide, qui ne dirait rien de plus
  // que NULL tout en ayant l'air d'une déclaration.
  active_langs: text('active_langs').array(),
  // D1.1 / N1.2 — altitude du niveau de référence, Z = 0. Nullable : une
  // altitude absolue non relevée n'invalide pas les altitudes relatives.
  reference_elevation_m: numeric('reference_elevation_m'),
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
  // N1.2 — largeur héritée par les arêtes du bâtiment à leur création.
  default_edge_width_m: numeric('default_edge_width_m'),
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
  // N1.2 — code d'unité locative, requis pour une cellule, unique par niveau.
  // Nullable : une empreinte relevée avant que son code soit connu doit
  // pouvoir être enregistrée ; c'est le contrôle qui la signale, pas la base
  // qui la refuse.
  unit_code: text('unit_code'),
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
  // K2.1 — manual painter order; null by default, overrides the computed sort.
  render_order: integer('render_order'),
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
