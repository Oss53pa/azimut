import { uuid, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { azimut } from './azimut.js';
import { organization } from './org.js';

export const job = azimut.table('job', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  state: text('state').notNull().default('queued'),
  payload: jsonb('payload').notNull().default('{}'),
  result: jsonb('result'),
  attempts: integer('attempts').notNull().default(0),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  started_at: timestamp('started_at', { withTimezone: true }),
  finished_at: timestamp('finished_at', { withTimezone: true }),
  error: text('error'),
}, (t) => [
  index('idx_job_org').on(t.org_id),
  index('idx_job_state').on(t.state).where(sql`state IN ('queued','running')`),
]);

export const auditLog = azimut.table('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  actor_id: uuid('actor_id'),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entity_id: uuid('entity_id'),
  before: jsonb('before'),
  after: jsonb('after'),
  occurred_at: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_audit_log_org').on(t.org_id),
]);
