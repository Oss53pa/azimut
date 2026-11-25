import { uuid, text, timestamp, bigint, jsonb, index, unique, primaryKey } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { azimut } from './azimut.js';
import { organization } from './org.js';
import { site, level } from './site.js';

/**
 * S6.2 — le journal des commandes validées (migration 0078).
 *
 * Insertion seule, et par `apply_journaled_commands` seulement : la table se
 * lit ici, elle ne s'écrit jamais par Drizzle.
 */
export const commandJournal = azimut.table('command_journal', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  site_id: uuid('site_id').notNull().references(() => site.id, { onDelete: 'restrict' }),
  level_id: uuid('level_id').references(() => level.id, { onDelete: 'restrict' }),
  seq: bigint('seq', { mode: 'number' }).notNull(),
  author_id: uuid('author_id').notNull().default(sql`azimut.current_user_id()`),
  command: jsonb('command').notNull(),
  recorded_at: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('command_journal_site_seq').on(t.site_id, t.seq),
  index('idx_command_journal_org').on(t.org_id),
  index('idx_command_journal_level_author').on(t.level_id, t.author_id, t.recorded_at),
]);

/**
 * S6.7b — la présence sur un niveau (migration 0081).
 *
 * S'écrit par `touch_presence` et `leave_presence`, se lit par
 * `level_presence_list` : jamais par Drizzle. L'heure de présence est posée
 * par la base.
 */
export const levelPresence = azimut.table('level_presence', {
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  level_id: uuid('level_id').notNull().references(() => level.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull().default(sql`azimut.current_user_id()`),
  selection: jsonb('selection').notNull().default(sql`'[]'::jsonb`),
  zone: jsonb('zone'),
  seen_at: timestamp('seen_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.level_id, t.user_id] }),
  index('idx_level_presence_org').on(t.org_id),
]);

/**
 * S6.4 — le verrou ferme (migration 0083).
 *
 * Se pose par `acquire_object_lock`, se lève par `release_object_lock`, se
 * lit par `live_object_locks` : jamais par Drizzle. Le refus d'écrire un
 * objet tenu par un autre est un déclencheur de chaque table métier.
 */
export const objectLock = azimut.table('object_lock', {
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  target_table: text('target_table').notNull(),
  target_id: uuid('target_id').notNull(),
  holder_id: uuid('holder_id').notNull().default(sql`azimut.current_user_id()`),
  acquired_at: timestamp('acquired_at', { withTimezone: true }).notNull().defaultNow(),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.target_table, t.target_id] }),
  index('idx_object_lock_org').on(t.org_id),
]);

/**
 * M02.W11 tenue par la base (migration 0085) : la révision du graphe d'un
 * site, et la dernière révision validée par le service. Écrite par la base
 * seule (déclencheurs, `record_service_validation`) : jamais par Drizzle.
 */
export const graphRevision = azimut.table('graph_revision', {
  site_id: uuid('site_id').primaryKey().references(() => site.id, { onDelete: 'cascade' }),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  revision: bigint('revision', { mode: 'number' }).notNull().default(0),
  changed_at: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
  validated_revision: bigint('validated_revision', { mode: 'number' }),
  validation_id: uuid('validation_id'),
}, (t) => [
  index('idx_graph_revision_org').on(t.org_id),
]);
