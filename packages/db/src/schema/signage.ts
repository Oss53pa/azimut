import { uuid, text, timestamp, integer, numeric, jsonb, index } from 'drizzle-orm/pg-core';
import { azimut } from './azimut.js';
import { organization } from './org.js';
import { site } from './site.js';
import { node } from './graph.js';

// A5.6 : typologie de support (gabarit d'un modèle physique). Le support
// instancie une typologie ; les dimensions restent portées par l'instance.
export const supportTypology = azimut.table('support_typology', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  name: text('name').notNull(),
  face_count: integer('face_count').notNull(),
  template_key: text('template_key'),
}, (t) => [
  index('idx_support_typology_org').on(t.org_id),
]);

export const support = azimut.table('support', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  site_id: uuid('site_id').notNull().references(() => site.id, { onDelete: 'cascade' }),
  // A5.6 et N2.2 : code lisible, unique par site, propriété du module 02
  // (implantation, scission L0). Nullable tant que les supports déjà écrits
  // n'ont pas de code : le rendre requis transformerait des données (A2.2-7).
  code: text('code'),
  node_id: uuid('node_id').notNull().references(() => node.id, { onDelete: 'cascade' }),
  // A5.6 : typologie de l'instance. Additif, nullable — cf. migration 0015.
  typology_id: uuid('typology_id').references(() => supportTypology.id, { onDelete: 'set null' }),
  kind: text('kind').notNull(),
  azimuth_deg: numeric('azimuth_deg').notNull().default('0'),
  height_m: numeric('height_m'),
  width_m: numeric('width_m'),
  // A5.6 : distance de lecture (formule de lisibilité) et registre (portée des
  // règles, durcissement safety). Additifs, nullables — cf. migration 0012.
  reading_distance_m: numeric('reading_distance_m'),
  registry: text('registry'),
  // A5.6 / D3.5 : contexte de lecture (interieur/exterieur), portée de la
  // lisibilité. Additif, nullable — cf. migration 0013.
  context: text('context'),
  // A5.6 : dimensions portées par l'instance (mm) et leur origine. Priment sur
  // le défaut de la typologie quand renseignées. Additifs — cf. migration 0014.
  width_mm: integer('width_mm'),
  height_mm: integer('height_mm'),
  dimensions_source: text('dimensions_source'),
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
  // A5.6 : identité de face par index, gabarit et langues. Additifs — cf.
  // migration 0016. `side` préexistant est laissé en place.
  face_index: integer('face_index'),
  template_key: text('template_key'),
  langs: jsonb('langs'),
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
  // A5.6 : index de bloc, liaison (contenu résolu) et texte libre. Additifs —
  // cf. migration 0016. `ordinal`/`config` préexistants sont laissés en place.
  block_index: integer('block_index'),
  binding: jsonb('binding'),
  free_text: jsonb('free_text'),
}, (t) => [
  index('idx_content_block_org').on(t.org_id),
]);

// A5.6 : versions d'un support (brouillon → relu → approuvé → remplacé), avec
// l'empreinte du contenu et le chemin de l'artwork produit.
export const supportVersion = azimut.table('support_version', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  support_id: uuid('support_id').notNull().references(() => support.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  state: text('state').notNull().default('draft'),
  artwork_path: text('artwork_path'),
  content_hash: text('content_hash'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  created_by: uuid('created_by'),
}, (t) => [
  index('idx_support_version_org').on(t.org_id),
  index('idx_support_version_support').on(t.support_id),
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
