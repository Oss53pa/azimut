import { uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { azimut } from './azimut.js';
import { organization } from './org.js';
import { site, zone } from './site.js';
import { support, supportFace } from './signage.js';
import { messageLine } from './wayfinding.js';

/**
 * J4 — l'annotation en révision (migration 0073). Ancrée sur exactement une
 * entité ; elle n'entre dans aucun calcul ni aucun livrable : aucun chargeur
 * de site ne la lit.
 */
export const reviewAnnotation = azimut.table('review_annotation', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  site_id: uuid('site_id').notNull().references(() => site.id, { onDelete: 'restrict' }),
  message_line_id: uuid('message_line_id').references(() => messageLine.id, { onDelete: 'restrict' }),
  support_face_id: uuid('support_face_id').references(() => supportFace.id, { onDelete: 'restrict' }),
  support_id: uuid('support_id').references(() => support.id, { onDelete: 'restrict' }),
  zone_id: uuid('zone_id').references(() => zone.id, { onDelete: 'restrict' }),
  state: text('state').notNull().default('open'),
  body: text('body').notNull().default(''),
  ink: jsonb('ink'),
  author_id: uuid('author_id').notNull(),
  resolved_by: uuid('resolved_by'),
  resolved_at: timestamp('resolved_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  index('idx_review_annotation_org').on(t.org_id),
  index('idx_review_annotation_site').on(t.site_id),
  index('idx_review_annotation_line').on(t.message_line_id),
  index('idx_review_annotation_face').on(t.support_face_id),
  index('idx_review_annotation_support').on(t.support_id),
  index('idx_review_annotation_zone').on(t.zone_id),
]);

export const reviewAnnotationReply = azimut.table('review_annotation_reply', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  annotation_id: uuid('annotation_id').notNull().references(() => reviewAnnotation.id, { onDelete: 'restrict' }),
  body: text('body').notNull(),
  author_id: uuid('author_id').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  index('idx_review_annotation_reply_org').on(t.org_id),
  index('idx_review_annotation_reply_annotation').on(t.annotation_id),
]);
