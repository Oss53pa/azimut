import {
  uuid, text, timestamp, date, integer, numeric, boolean, jsonb,
  uniqueIndex, index,
} from 'drizzle-orm/pg-core';
import { azimut } from './azimut.js';
import { organization } from './org.js';

export const site = azimut.table('site', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  country_code: text('country_code').notNull(),
  // O4 et A5.2 — fuseau du site, requis. Tous les horaires, disponibilités
  // d'arêtes et échéances s'y interprètent ; les horodatages techniques
  // restent en temps universel.
  timezone: text('timezone').notNull(),
  // Q5 — entité juridique émettrice. Facultative à la création, requise avant
  // l'émission de la première facture : elle ne sert qu'à facturer.
  legal_entity_id: uuid('legal_entity_id'),
  rules_pack_id: uuid('rules_pack_id'),
  // M01.S1 / D1.1 / N1.2 — origine du repère site, en mètres, recopiée du premier
  // calage et jamais modifiée. Nullable : tant qu'aucun calage n'a eu lieu, le
  // repère n'est pas posé, et ce n'est pas l'origine (0, 0).
  origin_x_m: numeric('origin_x_m'),
  origin_y_m: numeric('origin_y_m'),
  // N1.2 — langues actives. Nullable : une ligne antérieure à la migration
  // n'en déclare aucune, et la migration ne va pas en déclarer à sa place.
  // Le CHECK interdit en revanche le tableau vide, qui ne dirait rien de plus
  // que NULL tout en ayant l'air d'une déclaration.
  active_langs: text('active_langs').array(),
  // D1.1 / N1.2 — altitude du niveau de référence, Z = 0. Nullable : une
  // altitude absolue non relevée n'invalide pas les altitudes relatives.
  reference_elevation_m: numeric('reference_elevation_m'),
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
  // N1.2 — largeur héritée par les arêtes du bâtiment à leur création.
  default_edge_width_m: numeric('default_edge_width_m'),
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
  // N1.2 — code d'unité locative, requis pour une cellule, unique par niveau.
  // Nullable : une empreinte relevée avant que son code soit connu doit
  // pouvoir être enregistrée ; c'est le contrôle qui la signale, pas la base
  // qui la refuse.
  unit_code: text('unit_code'),
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
  // A5.2 — `ZONE_KINDS`, contrainte posée par la migration 0029. Zone du
  // socle, à ne pas confondre avec la zone d'orientation du module 02.
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
  // A5.2 — position, dans l'image, de l'origine du repère site. Seules
  // colonnes en pixels que M01.S2 admette avec celles des points de calage.
  // Nullables : l'origine du repère ne tombe pas dans l'image de tous les
  // calages, et aucun écran ne désigne aujourd'hui le point qui la porte.
  origin_x_px: numeric('origin_x_px'),
  origin_y_px: numeric('origin_y_px'),
  // A5.2 — distance réelle saisie à l'étape 2 de M2 (partie M), celle dont l'échelle est
  // tirée. Nullable : le calage par points mesurés n'en produit pas.
  reference_distance_m: numeric('reference_distance_m'),
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
  // M01.S1 — date de l'opération de calage, distincte de l'import du fond que date
  // `plan_source.uploaded_at`. C'est elle qui rend « le premier calage »
  // identifiable. Nullable et sans valeur par défaut : une ligne enregistrée
  // avant cette colonne n'a pas de date, et `now()` ferait passer la date de
  // la migration pour celle du calage.
  calibrated_at: timestamp('calibrated_at', { withTimezone: true }),
}, (t) => [
  index('idx_plan_calibration_org').on(t.org_id),
  // « Chacun est calé au plus une fois » : un fond porte un calage, pas deux.
  // Recaler (M01.S9) met la ligne à jour, il n'en ajoute pas une seconde.
  uniqueIndex('uq_plan_calibration_plan_source').on(t.plan_source_id),
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
  // A5.2 — `OPENING_KINDS`, contrainte posée par la migration 0029.
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

/** Complément atelier M2 — un parking, avec sa capacité annoncée et sa source. */
export const parking = azimut.table('parking', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  level_id: uuid('level_id').notNull().references(() => level.id, { onDelete: 'cascade' }),
  geometry: jsonb('geometry').notNull(),
  name: text('name').notNull(),
  free: boolean('free').notNull(),
  declared_capacity: integer('declared_capacity').notNull(),
  status: text('status').notNull(),
  source: text('source').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_parking_org').on(t.org_id),
]);

export const parkingSpace = azimut.table('parking_space', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  parking_id: uuid('parking_id').notNull().references(() => parking.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  row_label: text('row_label').notNull(),
  geometry: jsonb('geometry'),
  status: text('status').notNull(),
  source: text('source').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_parking_space_org').on(t.org_id),
  index('idx_parking_space_parking').on(t.parking_id),
]);

/** Là où le plan source s'arrête : sans elle, aucune extrapolation n'est visible. */
export const parkingUncoveredArea = azimut.table('parking_uncovered_area', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  parking_id: uuid('parking_id').notNull().references(() => parking.id, { onDelete: 'cascade' }),
  geometry: jsonb('geometry'),
  reason: text('reason').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_parking_uncovered_org').on(t.org_id),
  index('idx_parking_uncovered_parking').on(t.parking_id),
]);

export const vehicleGate = azimut.table('vehicle_gate', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  level_id: uuid('level_id').notNull().references(() => level.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  role: text('role').notNull(),
  width_m: numeric('width_m').notNull(),
  position: jsonb('position').notNull(),
  status: text('status').notNull(),
  source: text('source').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_vehicle_gate_org').on(t.org_id),
]);

/**
 * A5.2 — les points de calage d'une source de plan.
 *
 * « Les points de calage permettent de rejouer le calage à l'identique. » Sans
 * eux, la base garde l'échelle obtenue et jamais la mesure qui l'a produite.
 * Les coordonnées sont en pixels de l'image, seconde des deux exceptions que
 * M01.S2 admet.
 */
export const planCalibrationPoint = azimut.table('plan_calibration_point', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  calibration_id: uuid('calibration_id').notNull()
    .references(() => planCalibration.id, { onDelete: 'cascade' }),
  ordinal: integer('ordinal').notNull(),
  image_x_px: numeric('image_x_px').notNull(),
  image_y_px: numeric('image_y_px').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_plan_calibration_point_org').on(t.org_id),
  index('idx_plan_calibration_point_calibration').on(t.calibration_id),
  uniqueIndex('plan_calibration_point_calibration_id_ordinal_key')
    .on(t.calibration_id, t.ordinal),
]);

/**
 * Q5 — l'entité juridique qui émet une facture.
 *
 * Elle appartient à la plateforme (Q2) : une organisation en contient une ou
 * plusieurs, et un site est rattaché à une seule, au plus tard avant sa
 * première facture.
 */
export const legalEntity = azimut.table('legal_entity', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  legal_name: text('legal_name').notNull(),
  registration_ref: text('registration_ref'),
  tax_ref: text('tax_ref'),
  address: jsonb('address'),
  country_code: text('country_code').notNull(),
  currency_code: text('currency_code').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_legal_entity_org').on(t.org_id),
]);
