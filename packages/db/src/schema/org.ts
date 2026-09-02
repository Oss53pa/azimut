import { uuid, text, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { azimut } from './azimut.js';

export const organization = azimut.table('organization', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const membership = azimut.table('membership', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull(),
  role: text('role').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('membership_org_user').on(t.org_id, t.user_id),
  index('idx_membership_org').on(t.org_id),
  index('idx_membership_user').on(t.user_id),
]);
