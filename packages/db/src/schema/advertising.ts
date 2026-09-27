import { uuid, text, timestamp, integer, bigint, numeric, date, index, unique } from 'drizzle-orm/pg-core';
import { azimut } from './azimut.js';
import { organization } from './org.js';
import { site, level } from './site.js';
import { node } from './graph.js';

/**
 * H4 — les tables du module 05, régie publicitaire.
 *
 * Migration `0045` (famille C de la proposition de schéma, 5.1). Aucune
 * contrainte d'exclusion sur le chevauchement des réservations : le garde le
 * relève, la base le laisse s'enregistrer (décision 7.7).
 */

export const adPlacement = azimut.table('ad_placement', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  site_id: uuid('site_id').notNull().references(() => site.id, { onDelete: 'restrict' }),
  code: text('code').notNull(),
  level_id: uuid('level_id').notNull().references(() => level.id, { onDelete: 'restrict' }),
  node_id: uuid('node_id').references(() => node.id, { onDelete: 'set null' }),
  typology_key: text('typology_key').notNull(),
  area_m2: numeric('area_m2').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  index('idx_ad_placement_org').on(t.org_id),
  index('idx_ad_placement_site').on(t.site_id),
  unique().on(t.site_id, t.code),
]);

export const adBooking = azimut.table('ad_booking', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  placement_id: uuid('placement_id').notNull().references(() => adPlacement.id, { onDelete: 'restrict' }),
  state: text('state').notNull(),
  from_date: date('from_date').notNull(),
  to_date: date('to_date').notNull(),
  advertiser_name: text('advertiser_name'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_ad_booking_org').on(t.org_id),
  index('idx_ad_booking_placement').on(t.placement_id),
]);

export const adOption = azimut.table('ad_option', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  placement_id: uuid('placement_id').notNull().references(() => adPlacement.id, { onDelete: 'restrict' }),
  expires_at: date('expires_at').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_ad_option_org').on(t.org_id),
  index('idx_ad_option_placement').on(t.placement_id),
]);

export const adCreative = azimut.table('ad_creative', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  placement_id: uuid('placement_id').notNull().references(() => adPlacement.id, { onDelete: 'restrict' }),
  format: text('format').notNull(),
  resolution_dpi: integer('resolution_dpi').notNull(),
  safe_zone_mm: integer('safe_zone_mm').notNull(),
  color_profile: text('color_profile').notNull(),
  weight_bytes: bigint('weight_bytes', { mode: 'number' }).notNull(),
  storage_path: text('storage_path'),
  sanitation: text('sanitation').notNull(),
  verdict: text('verdict').notNull().default('human_review'),
  received_at: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_ad_creative_org').on(t.org_id),
  index('idx_ad_creative_placement').on(t.placement_id),
]);
