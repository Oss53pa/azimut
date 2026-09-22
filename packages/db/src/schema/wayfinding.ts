import {
  uuid, text, timestamp, integer, jsonb, boolean,
  uniqueIndex, index,
} from 'drizzle-orm/pg-core';
import { azimut } from './azimut.js';
import { organization } from './org.js';
import { site } from './site.js';
import { node } from './graph.js';
import { travelProfile, pictogram } from './directory.js';
import { supportTypology, support } from './signage.js';

/**
 * N2.2 — les tables du module 02, wayfinding.
 *
 * Migration `0027`. Le module possède aussi les attributs d'implantation de
 * `support` (scission L0), qui restent définis avec la table elle-même dans
 * `signage.ts` : une table n'a qu'une définition, même quand deux modules s'en
 * partagent les colonnes.
 */

export const orientationZone = azimut.table('orientation_zone', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  site_id: uuid('site_id').notNull().references(() => site.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  name_fr: text('name_fr').notNull(),
  name_en: text('name_en').notNull(),
  kind: text('kind').notNull(),
  footprint_ids: jsonb('footprint_ids').notNull().default([]),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('orientation_zone_site_code').on(t.site_id, t.code),
  index('idx_orientation_zone_org').on(t.org_id),
]);

export const namingRule = azimut.table('naming_rule', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  site_id: uuid('site_id').notNull().references(() => site.id, { onDelete: 'cascade' }),
  target: text('target').notNull(),
  pattern: text('pattern').notNull(),
  max_length: integer('max_length').notNull(),
  uniqueness_scope: text('uniqueness_scope').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_naming_rule_org').on(t.org_id),
]);

export const informationLevel = azimut.table('information_level', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  typology_id: uuid('typology_id').notNull()
    .references(() => supportTypology.id, { onDelete: 'cascade' }),
  level: integer('level').notNull(),
}, (t) => [
  uniqueIndex('information_level_typology_level').on(t.typology_id, t.level),
  index('idx_information_level_org').on(t.org_id),
]);

export const wayfindingSequence = azimut.table('wayfinding_sequence', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  site_id: uuid('site_id').notNull().references(() => site.id, { onDelete: 'cascade' }),
  profile_id: uuid('profile_id').notNull()
    .references(() => travelProfile.id, { onDelete: 'cascade' }),
  ordinal: integer('ordinal').notNull(),
  node_id: uuid('node_id').notNull().references(() => node.id, { onDelete: 'cascade' }),
  expected_level: integer('expected_level').notNull(),
}, (t) => [
  uniqueIndex('wayfinding_sequence_profile_ordinal').on(t.profile_id, t.ordinal),
  index('idx_wayfinding_sequence_org').on(t.org_id),
]);

export const messageSchedule = azimut.table('message_schedule', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  site_id: uuid('site_id').notNull().references(() => site.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  // N2.2 et R12 : draft, in_review, approved, superseded. Et eux seuls.
  state: text('state').notNull().default('draft'),
  generated_at: timestamp('generated_at', { withTimezone: true }).notNull(),
  inputs_hash: text('inputs_hash').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('message_schedule_site_version').on(t.site_id, t.version),
  index('idx_message_schedule_org').on(t.org_id),
]);

export const messageLine = azimut.table('message_line', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  schedule_id: uuid('schedule_id').notNull()
    .references(() => messageSchedule.id, { onDelete: 'cascade' }),
  support_id: uuid('support_id').notNull()
    .references(() => support.id, { onDelete: 'cascade' }),
  face_index: integer('face_index').notNull(),
  block_index: integer('block_index').notNull(),
  content: jsonb('content').notNull(),
  pictogram_id: uuid('pictogram_id').references(() => pictogram.id, { onDelete: 'set null' }),
  direction: text('direction'),
  information_level: integer('information_level').notNull(),
  // M02.W4 : non nullable en base, et pas seulement refusé par le moteur.
  decision_point_id: uuid('decision_point_id').notNull()
    .references(() => node.id, { onDelete: 'cascade' }),
  stale: boolean('stale').notNull().default(false),
  // M02.W9, décision reportée en N2.2 et H11 : l'écartement est tracé.
  excluded: boolean('excluded').notNull().default(false),
  exclusion_reason: jsonb('exclusion_reason'),
}, (t) => [
  uniqueIndex('message_line_position')
    .on(t.schedule_id, t.support_id, t.face_index, t.block_index),
  index('idx_message_line_org').on(t.org_id),
  index('idx_message_line_schedule').on(t.schedule_id),
]);
