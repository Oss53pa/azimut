import {
  uuid, text, timestamp, integer, bigint, boolean, index,
} from 'drizzle-orm/pg-core';
import { azimut } from './azimut.js';
import { organization } from './org.js';
import { site } from './site.js';

/**
 * D11 — a produced delivery archive (site/building/level/version), its storage
 * location, integrity checksum and the quantitative it carries. One row per
 * assembled archive.
 */
export const deliveryPackage = azimut.table('delivery_package', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  site_id: uuid('site_id').notNull().references(() => site.id, { onDelete: 'restrict' }),
  site_code: text('site_code').notNull(),
  building: text('building').notNull(),
  level: text('level').notNull(),
  version: integer('version').notNull(),
  archive_name: text('archive_name').notNull(),
  storage_path: text('storage_path').notNull(),
  checksum: text('checksum').notNull(),
  file_count: integer('file_count').notNull(),
  total_bytes: bigint('total_bytes', { mode: 'number' }).notNull(),
  total_supports: integer('total_supports').notNull(),
  total_faces: integer('total_faces').notNull(),
  cross_check_ok: boolean('cross_check_ok').notNull(),
  built_at: timestamp('built_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_delivery_package_org').on(t.org_id),
]);
