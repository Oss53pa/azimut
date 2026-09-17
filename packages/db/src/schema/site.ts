import { uuid, text, timestamp, date, integer, numeric, boolean, jsonb, index } from 'drizzle-orm/pg-core';
import { azimut } from './azimut.js';
import { organization } from './org.js';

export const site = azimut.table('site', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  country_code: text('country_code').notNull(),
  rules_pack_id: uuid('rules_pack_id'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  index('idx_site_org').on(t.org_id),
]);

export const building = azimut.table('building', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  site_id: uuid('site_id').notNull().references(() => site.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  independent_access: boolean('independent_access').notNull().default(false),
  opening_hours: jsonb('opening_hours'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_building_org').on(t.org_id),
  index('idx_building_site').on(t.site_id),
]);

export const level = azimut.table('level', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  building_id: uuid('building_id').notNull().references(() => building.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  ordinal: integer('ordinal').notNull(),
  elevation_m: numeric('elevation_m').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_level_org').on(t.org_id),
  index('idx_level_building').on(t.building_id),
]);

export const footprint = azimut.table('footprint', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  level_id: uuid('level_id').notNull().references(() => level.id, { onDelete: 'cascade' }),
  geometry: jsonb('geometry').notNull(),
  kind: text('kind').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_footprint_org').on(t.org_id),
]);

export const volume = azimut.table('volume', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  footprint_id: uuid('footprint_id').notNull().references(() => footprint.id, { onDelete: 'cascade' }),
  base_elevation_m: numeric('base_elevation_m').notNull(),
  height_m: numeric('height_m').notNull(),
  material_key: text('material_key').notNull(),
  // K2.1 — manual painter order; null by default, overrides the computed sort.
  render_order: integer('render_order'),
}, (t) => [
  index('idx_volume_org').on(t.org_id),
]);

export const zone = azimut.table('zone', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  level_id: uuid('level_id').notNull().references(() => level.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_zone_org').on(t.org_id),
]);

export const planSource = azimut.table('plan_source', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  level_id: uuid('level_id').notNull().references(() => level.id, { onDelete: 'cascade' }),
  storage_path: text('storage_path').notNull(),
  media_type: text('media_type').notNull(),
  uploaded_at: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_plan_source_org').on(t.org_id),
]);

export const planCalibration = azimut.table('plan_calibration', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  plan_source_id: uuid('plan_source_id').notNull().references(() => planSource.id, { onDelete: 'cascade' }),
  scale_m_per_px: numeric('scale_m_per_px').notNull(),
  origin_x: numeric('origin_x').notNull(),
  origin_y: numeric('origin_y').notNull(),
  rotation_deg: numeric('rotation_deg').notNull().default('0'),
  // Complément atelier M1.4 : transformation affine ajustée par moindres
  // carrés. Nulles tant que le plan n'est calé qu'à deux points.
  affine_a: numeric('affine_a'),
  affine_b: numeric('affine_b'),
  affine_c: numeric('affine_c'),
  affine_d: numeric('affine_d'),
  affine_e: numeric('affine_e'),
  affine_f: numeric('affine_f'),
  mean_residual_m: numeric('mean_residual_m'),
  max_residual_m: numeric('max_residual_m'),
}, (t) => [
  index('idx_plan_calibration_org').on(t.org_id),
]);

/**
 * Complément atelier M1.4 : les points homologues qui fondent le calage
 * mesuré. `residual_m` est calculé par l'ajustement, jamais saisi.
 */
export const controlPoint = azimut.table('control_point', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  calibration_id: uuid('calibration_id').notNull().references(() => planCalibration.id, { onDelete: 'cascade' }),
  source_x_px: numeric('source_x_px').notNull(),
  source_y_px: numeric('source_y_px').notNull(),
  target_x_m: numeric('target_x_m').notNull(),
  target_y_m: numeric('target_y_m').notNull(),
  residual_m: numeric('residual_m'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_control_point_org').on(t.org_id),
  index('idx_control_point_calibration').on(t.calibration_id),
]);

export const opening = azimut.table('opening', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  footprint_id: uuid('footprint_id').notNull().references(() => footprint.id, { onDelete: 'cascade' }),
  position: jsonb('position').notNull(),
  width_m: numeric('width_m').notNull(),
  kind: text('kind').notNull(),
}, (t) => [
  index('idx_opening_org').on(t.org_id),
]);

/**
 * Complément atelier M3 — un fait vérifié du site. `source` et `recorded_on`
 * sont obligatoires : une affirmation sans provenance ne se conteste pas.
 */
export const siteFact = azimut.table('site_fact', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  site_id: uuid('site_id').notNull().references(() => site.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  value: text('value').notNull(),
  source: text('source').notNull(),
  // Colonne `date` en base : la déclarer `text` rendrait un `Date` typé
  // `string`, et les comparaisons de chaînes qui la trient échoueraient.
  recorded_on: date('recorded_on').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_site_fact_org').on(t.org_id),
]);

/** Les mots qu'un fait bannit, chacun dans la langue où il est interdit. */
export const siteFactForbiddenWord = azimut.table('site_fact_forbidden_word', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  site_fact_id: uuid('site_fact_id').notNull().references(() => siteFact.id, { onDelete: 'cascade' }),
  lang: text('lang').notNull(),
  term: text('term').notNull(),
}, (t) => [
  index('idx_site_fact_word_org').on(t.org_id),
  index('idx_site_fact_word_fact').on(t.site_fact_id),
]);

/**
 * Complément atelier M16 — ce qu'une source affirme d'un objet, à une date.
 * Deux affirmations divergentes sur la même clé font un écart, pas un fait.
 */
export const sourceClaim = azimut.table('source_claim', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  site_id: uuid('site_id').notNull().references(() => site.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  source: text('source').notNull(),
  value: text('value').notNull(),
  // Colonne `date` en base : la déclarer `text` rendrait un `Date` typé
  // `string`, et les comparaisons de chaînes qui la trient échoueraient.
  recorded_on: date('recorded_on').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_source_claim_org').on(t.org_id),
  index('idx_source_claim_key').on(t.site_id, t.key),
]);

/**
 * La décision qui clôt un écart. Elle nomme la source retenue et non la valeur :
 * si la source se corrige, la décision suit au lieu de figer un chiffre.
 */
export const discrepancyDecision = azimut.table('discrepancy_decision', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  site_id: uuid('site_id').notNull().references(() => site.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  decided_source: text('decided_source').notNull(),
  decided_by: text('decided_by').notNull(),
  decided_on: date('decided_on').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_discrepancy_decision_org').on(t.org_id),
]);
