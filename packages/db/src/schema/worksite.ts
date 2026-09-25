import {
  uuid, text, timestamp, boolean, date, index, unique,
} from 'drizzle-orm/pg-core';
import { azimut } from './azimut.js';
import { organization } from './org.js';
import { site } from './site.js';
import { support } from './signage.js';

/**
 * H6 — les tables du module 07, chantier et pose.
 *
 * Migration `0042` (famille C de la proposition de schéma, 5.3). Le nombre de
 * supports d'un lot ou d'un créneau se calcule depuis les tables de liaison,
 * il ne se stocke pas.
 */

export const fabricationLot = azimut.table('fabrication_lot', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  site_id: uuid('site_id').notNull().references(() => site.id, { onDelete: 'restrict' }),
  code: text('code').notNull(),
  manufacturer_name: text('manufacturer_name').notNull(),
  state: text('state').notNull().default('ordered'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_fabrication_lot_org').on(t.org_id),
  unique().on(t.site_id, t.code),
]);

export const lotSupport = azimut.table('lot_support', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  lot_id: uuid('lot_id').notNull().references(() => fabricationLot.id, { onDelete: 'cascade' }),
  support_id: uuid('support_id').notNull().unique().references(() => support.id, { onDelete: 'cascade' }),
}, (t) => [
  index('idx_lot_support_org').on(t.org_id),
  index('idx_lot_support_lot').on(t.lot_id),
]);

export const installSlot = azimut.table('install_slot', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  site_id: uuid('site_id').notNull().references(() => site.id, { onDelete: 'restrict' }),
  zone_label: text('zone_label').notNull(),
  planned_on: date('planned_on'),
  night_work: boolean('night_work').notNull().default(false),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_install_slot_org').on(t.org_id),
]);

export const slotSupport = azimut.table('slot_support', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  slot_id: uuid('slot_id').notNull().references(() => installSlot.id, { onDelete: 'cascade' }),
  support_id: uuid('support_id').notNull().references(() => support.id, { onDelete: 'cascade' }),
}, (t) => [
  index('idx_slot_support_org').on(t.org_id),
  index('idx_slot_support_slot').on(t.slot_id),
  unique().on(t.slot_id, t.support_id),
]);

export const installReserve = azimut.table('install_reserve', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  support_id: uuid('support_id').notNull().references(() => support.id, { onDelete: 'restrict' }),
  lot_id: uuid('lot_id').notNull().references(() => fabricationLot.id, { onDelete: 'restrict' }),
  observation_key: text('observation_key').notNull(),
  observed_by: text('observed_by').notNull(),
  observed_at: timestamp('observed_at', { withTimezone: true }).notNull().defaultNow(),
  lifted_at: timestamp('lifted_at', { withTimezone: true }),
  photo_path: text('photo_path'),
}, (t) => [
  index('idx_install_reserve_org').on(t.org_id),
  index('idx_install_reserve_lot').on(t.lot_id),
  index('idx_install_reserve_support').on(t.support_id),
]);
