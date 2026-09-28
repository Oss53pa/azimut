import { uuid, text, timestamp, integer, boolean, jsonb, date, index, unique } from 'drizzle-orm/pg-core';
import { azimut } from './azimut.js';
import { organization } from './org.js';
import { site } from './site.js';
import { destination } from './directory.js';

/**
 * H5 — les tables du module 06, enseignes locataires.
 *
 * Migration `0046` (famille C de la proposition de schéma, 5.2). Le règlement
 * se versionne par sa date d'effet ; le dossier se rattache à la cellule par
 * sa destination.
 */

export const tenantSignRegulation = azimut.table('tenant_sign_regulation', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  site_id: uuid('site_id').notNull().references(() => site.id, { onDelete: 'restrict' }),
  max_height_mm: integer('max_height_mm'),
  max_overhang_mm: integer('max_overhang_mm'),
  allowed_materials: jsonb('allowed_materials').notNull().default([]),
  allowed_lighting: jsonb('allowed_lighting').notNull().default([]),
  forbidden_features: jsonb('forbidden_features').notNull().default([]),
  effective_from: date('effective_from').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_tenant_sign_regulation_org').on(t.org_id),
  unique().on(t.site_id, t.effective_from),
]);

export const tenantSignDossier = azimut.table('tenant_sign_dossier', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  site_id: uuid('site_id').notNull().references(() => site.id, { onDelete: 'restrict' }),
  destination_id: uuid('destination_id').notNull().references(() => destination.id, { onDelete: 'restrict' }),
  state: text('state').notNull().default('submitted'),
  submitted_on: date('submitted_on').notNull(),
  height_mm: integer('height_mm').notNull(),
  overhang_mm: integer('overhang_mm').notNull(),
  material: text('material').notNull(),
  lighting: text('lighting').notNull(),
  features: jsonb('features').notNull().default([]),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_tenant_sign_dossier_org').on(t.org_id),
  index('idx_tenant_sign_dossier_site').on(t.site_id),
]);

export const tenantSignPart = azimut.table('tenant_sign_part', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  dossier_id: uuid('dossier_id').notNull().references(() => tenantSignDossier.id, { onDelete: 'restrict' }),
  key: text('key').notNull(),
  provided: boolean('provided').notNull().default(false),
  storage_path: text('storage_path'),
}, (t) => [
  index('idx_tenant_sign_part_org').on(t.org_id),
  index('idx_tenant_sign_part_dossier').on(t.dossier_id),
  unique().on(t.dossier_id, t.key),
]);
