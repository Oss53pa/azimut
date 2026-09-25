import { uuid, text, timestamp, date, index } from 'drizzle-orm/pg-core';
import { azimut } from './azimut.js';
import { organization } from './org.js';
import { site } from './site.js';
import { support } from './signage.js';

/**
 * I5.6 — les tournées d'inspection du module 08.
 *
 * Migration `0044` (famille C de la proposition de schéma, 5.4). Le nombre de
 * constats d'une tournée se compte, il ne se stocke pas.
 */

export const inspectionRound = azimut.table('inspection_round', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  site_id: uuid('site_id').notNull().references(() => site.id, { onDelete: 'restrict' }),
  zone_label: text('zone_label').notNull(),
  surveyor_id: uuid('surveyor_id'),
  surveyed_on: date('surveyed_on'),
  sync_state: text('sync_state').notNull().default('pending'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_inspection_round_org').on(t.org_id),
  index('idx_inspection_round_site').on(t.site_id),
]);

export const inspectionFinding = azimut.table('inspection_finding', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  round_id: uuid('round_id').notNull().references(() => inspectionRound.id, { onDelete: 'restrict' }),
  support_id: uuid('support_id').notNull().references(() => support.id, { onDelete: 'restrict' }),
  nature_key: text('nature_key').notNull(),
  severity: text('severity').notNull(),
  photo_path: text('photo_path'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_inspection_finding_org').on(t.org_id),
  index('idx_inspection_finding_round').on(t.round_id),
]);
