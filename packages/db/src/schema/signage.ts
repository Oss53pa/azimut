import { uuid, text, timestamp, integer, numeric, jsonb, index } from 'drizzle-orm/pg-core';
import { azimut } from './azimut.js';
import { organization } from './org.js';
import { site } from './site.js';
import { node } from './graph.js';

export const support = azimut.table('support', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  site_id: uuid('site_id').notNull().references(() => site.id, { onDelete: 'cascade' }),
  node_id: uuid('node_id').notNull().references(() => node.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  azimuth_deg: numeric('azimuth_deg').notNull().default('0'),
  height_m: numeric('height_m'),
  width_m: numeric('width_m'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  index('idx_support_org').on(t.org_id),
]);

export const supportFace = azimut.table('support_face', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  support_id: uuid('support_id').notNull().references(() => support.id, { onDelete: 'cascade' }),
  side: text('side').notNull(),
  width_mm: numeric('width_mm'),
  height_mm: numeric('height_mm'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_support_face_org').on(t.org_id),
]);

export const supportContentBlock = azimut.table('support_content_block', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  face_id: uuid('face_id').notNull().references(() => supportFace.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  ordinal: integer('ordinal').notNull(),
  config: jsonb('config').notNull().default({}),
}, (t) => [
  index('idx_content_block_org').on(t.org_id),
]);

export const proof = azimut.table('proof', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  face_id: uuid('face_id').notNull().references(() => supportFace.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  storage_path: text('storage_path').notNull(),
  status: text('status').notNull().default('pending'),
  submitted_at: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  reviewed_at: timestamp('reviewed_at', { withTimezone: true }),
  reviewer_id: uuid('reviewer_id'),
}, (t) => [
  index('idx_proof_org').on(t.org_id),
]);

export const approval = azimut.table('approval', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  proof_id: uuid('proof_id').notNull().references(() => proof.id, { onDelete: 'cascade' }),
  decision: text('decision').notNull(),
  reviewer_id: uuid('reviewer_id').notNull(),
  comment: text('comment').notNull().default(''),
  decided_at: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_approval_org').on(t.org_id),
  index('idx_approval_proof').on(t.proof_id),
]);

export const installedSupport = azimut.table('installed_support', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  support_id: uuid('support_id').notNull().references(() => support.id, { onDelete: 'cascade' }),
  installed_at: timestamp('installed_at', { withTimezone: true }).notNull().defaultNow(),
  photo_path: text('photo_path'),
  installer_notes: text('installer_notes'),
}, (t) => [
  index('idx_installed_support_org').on(t.org_id),
]);

export const divergence = azimut.table('divergence', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  installed_support_id: uuid('installed_support_id').notNull().references(() => installedSupport.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  detected_at: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
  resolved_at: timestamp('resolved_at', { withTimezone: true }),
  notes: text('notes'),
}, (t) => [
  index('idx_divergence_org').on(t.org_id),
]);

export const workOrder = azimut.table('work_order', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  site_id: uuid('site_id').notNull().references(() => site.id, { onDelete: 'cascade' }),
  scope: jsonb('scope'),
  estimated_cost: numeric('estimated_cost'),
  currency: text('currency').notNull().default('EUR'),
  state: text('state').notNull().default('draft'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  closed_at: timestamp('closed_at', { withTimezone: true }),
}, (t) => [
  index('idx_work_order_org').on(t.org_id),
]);
