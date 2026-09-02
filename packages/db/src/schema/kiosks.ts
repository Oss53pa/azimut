import { uuid, text, timestamp, integer, numeric, jsonb, index } from 'drizzle-orm/pg-core';
import { azimut } from './azimut.js';
import { organization } from './org.js';
import { site, building } from './site.js';
import { node } from './graph.js';

export const kiosk = azimut.table('kiosk', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  site_id: uuid('site_id').notNull().references(() => site.id, { onDelete: 'cascade' }),
  node_id: uuid('node_id').notNull().references(() => node.id, { onDelete: 'cascade' }),
  azimuth_deg: numeric('azimuth_deg').notNull().default('0'),
  default_lang: text('default_lang').notNull().default('fr'),
  building_id: uuid('building_id').notNull().references(() => building.id, { onDelete: 'cascade' }),
  hardware_profile: jsonb('hardware_profile'),
  label: text('label').notNull().default(''),
}, (t) => [
  index('idx_kiosk_org').on(t.org_id),
]);

export const kioskPackage = azimut.table('kiosk_package', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  site_id: uuid('site_id').notNull().references(() => site.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  storage_path: text('storage_path').notNull(),
  checksum: text('checksum').notNull(),
  built_at: timestamp('built_at', { withTimezone: true }).notNull().defaultNow(),
  content_hash: text('content_hash').notNull(),
}, (t) => [
  index('idx_kiosk_package_org').on(t.org_id),
]);

export const kioskTelemetry = azimut.table('kiosk_telemetry', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  kiosk_id: uuid('kiosk_id').notNull().references(() => kiosk.id, { onDelete: 'cascade' }),
  occurred_at: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  event_kind: text('event_kind').notNull(),
  payload: jsonb('payload').notNull().default('{}'),
}, (t) => [
  index('idx_kiosk_telemetry_org').on(t.org_id),
]);
