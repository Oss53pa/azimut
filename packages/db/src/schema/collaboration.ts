import { uuid, timestamp, bigint, jsonb, index, unique } from 'drizzle-orm/pg-core';
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
]);
