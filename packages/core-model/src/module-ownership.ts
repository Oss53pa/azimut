/**
 * L1 de la partie L — propriété unique, déclarée.
 *
 * « INT-1. Propriété unique. Chaque entité appartient à exactement un module. Lui
 * seul l'écrit. Une entité sans propriétaire déclaré ne peut pas être créée. »
 *
 * Ce fichier est ce registre. Il ne contient que ce que les fiches de modules
 * de L3 nomment, mot pour mot. Une table que les quatorze documents
 * n'attribuent pas figure dans `TABLES_WITHOUT_DECLARED_OWNER`, avec son
 * motif — jamais attribuée d'office, ce qui serait inventer.
 */

// ---------------------------------------------------------------------------
// Les douze modules et leurs couches (L2)
// ---------------------------------------------------------------------------

export const MODULE_KEYS = [
  '01-socle', '02-wayfinding', '03-parcours', '04-signaletique',
  '05-regie', '06-enseignes', '07-chantier', '08-exploitation',
  '09-budget', '10-portefeuille', '11-transverse', '12-atelier',
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

/**
 * L2 — « Une couche lit les couches inférieures, jamais les supérieures. »
 *
 * L'atelier n'est pas une couche : c'est la surface d'édition commune, qui
 * sert les couches 0 à 2 et ne possède aucune donnée métier. Son rang est donc
 * celui de la couche la plus haute qu'il sert, et il ne lit rien au-dessus.
 */
export const MODULE_LAYER: Readonly<Record<ModuleKey, number>> = {
  '01-socle': 0,
  '02-wayfinding': 1,
  '03-parcours': 1,
  '04-signaletique': 2,
  '05-regie': 2,
  '06-enseignes': 2,
  '07-chantier': 3,
  '08-exploitation': 3,
  '09-budget': 3,
  '10-portefeuille': 4,
  '11-transverse': 4,
  '12-atelier': 2,
};

/**
 * Modules que L3 et N déclarent non optionnels.
 *
 * Le socle « n'entre pas dans le modèle de droits ». Le wayfinding est « un
 * préalable dur de la production, et non une option commerciale. À traiter
 * comme le socle ». L'atelier : « Sans objet. L'atelier n'est pas optionnel. »
 */
export const NON_OPTIONAL_MODULES: readonly ModuleKey[] = [
  '01-socle', '02-wayfinding', '11-transverse', '12-atelier',
];

// ---------------------------------------------------------------------------
// INT-1 — qui possède quoi
// ---------------------------------------------------------------------------

/**
 * Les tables que chaque module possède, telles que L3 les nomme.
 *
 * Seules figurent ici celles qui existent au schéma. Les entités que L3 nomme
 * et que le schéma n'a pas encore — `message_line`, `orientation_zone`,
 * `ad_placement`, `sketch_layer`… — ne sont pas inventées : elles entreront
 * avec la tranche qui les construit.
 */
export const OWNED_TABLES: Readonly<Record<ModuleKey, readonly string[]>> = {
  '01-socle': [
    'site', 'building', 'level', 'zone', 'plan_source', 'plan_calibration',
    'footprint', 'volume', 'opening', 'node', 'edge', 'vertical_link',
    'building_link', 'destination', 'destination_name', 'category',
  ],
  // N2.2, migration 0027. Le module possède aussi les attributs
  // d'implantation de `support` — dont `code` — par la scission L0, déclarée
  // dans SUPPORT_COLUMN_OWNER.
  '02-wayfinding': [
    'orientation_zone', 'naming_rule', 'information_level',
    'wayfinding_sequence', 'message_schedule', 'message_line',
  ],
  '03-parcours': ['travel_profile', 'route_cache', 'decision_point'],
  '04-signaletique': [
    'support_typology', 'support_face', 'support_content_block',
    'support_version', 'proof', 'approval', 'pictogram',
  ],
  '05-regie': [],
  '06-enseignes': [],
  '07-chantier': [],
  '08-exploitation': ['installed_support', 'divergence', 'work_order'],
  '09-budget': [],
  '10-portefeuille': [],
  '11-transverse': [],
  '12-atelier': [],
};

// ---------------------------------------------------------------------------
// L0 — la scission de `support`, prioritaire sur A5.6
// ---------------------------------------------------------------------------

/**
 * « L'implantation d'un support est une décision de wayfinding, pas de
 * signalétique. Où l'on pose un support, de quelle typologie et à quel niveau
 * d'information, relève de la stratégie d'orientation. À quoi il ressemble et
 * comment il se fabrique relève de la production. »
 *
 * La table `support` a donc deux propriétaires, colonne par colonne. C'est la
 * seule table du modèle dans ce cas, et c'est ce qui supprime le cycle entre
 * les modules 02 et 04.
 */
export const SUPPORT_COLUMN_OWNER: Readonly<Record<string, ModuleKey>> = {
  // Wayfinding : nœud, azimut, typologie, distance de lecture. Le niveau
  // d'information lui revient aussi, mais sa colonne n'existe pas encore :
  // voir COLUMNS_SPECIFIED_NOT_YET_IN_SCHEMA.
  // A5.6 : « implantation, soit code, node_id, azimuth_deg, typology_id,
  // reading_distance_m, au module 02 ».
  code: '02-wayfinding',
  node_id: '02-wayfinding',
  azimuth_deg: '02-wayfinding',
  typology_id: '02-wayfinding',
  reading_distance_m: '02-wayfinding',
  // Signalétique : cotes. Le substrat et la fixation lui reviennent aussi,
  // et leurs colonnes n'existent pas encore non plus.
  width_mm: '04-signaletique',
  height_mm: '04-signaletique',
  dimensions_source: '04-signaletique',
  // D3.5 : portée de règle. Voir SUPPORT_CONTEXT_MANDATE. La composition la
  // lit, donc elle suit la fabrication.
  context: '04-signaletique',
};

/**
 * Colonnes que A5.6 et N4.2 spécifient et que le schéma n'a pas encore.
 *
 * Elles ne sont pas ajoutées d'avance. `support` n'appartient pas au module
 * 01 : L0 en donne l'implantation au wayfinding et la fabrication à la
 * signalétique. Les créer pendant la tranche 1 serait de la largeur avant la
 * profondeur. Chacune porte donc la tranche qui la construira, et le contrôle
 * de INT-1 vérifie qu'aucune n'est déclarée possédée tant qu'elle n'existe pas.
 */
export const COLUMNS_SPECIFIED_NOT_YET_IN_SCHEMA: Readonly<Record<string, string>> = {
  'support.substrate_key':
    'A5.6 et N4.2. Attribut de fabrication, module 04 (L0). Entre avec la tranche du module 04.',
  'support.mounting':
    'A5.6 et N4.2, structure de fixation. Attribut de fabrication, module 04 (L0). Même tranche.',
  'support.information_level_id':
    'L0 et L3 : le niveau d’information est un attribut d’implantation, module 02. La table `information_level` qu’il référence n’existe pas non plus. Entre avec la tranche 2.',
  'support_typology.default_substrate':
    'N4.2. `support_typology` appartient au module 04 (L3). Entre avec la tranche du module 04.',
  'support_typology.registry':
    'N4.2 porte `registry` sur la typologie ; A5.6 le porte sur le support, où il existe déjà. Divergence entre deux documents de même rang, à trancher au moment du module 04 (A2.2-3).',
};

/**
 * `support.context` : colonne présente au schéma qu'aucune table de A5.6 ne
 * liste, et qui a pourtant un mandat.
 *
 * D3.5 range `context` parmi les portées d'une règle, entre `supportRegistry`
 * et `sectorKey` dans l'ordre de spécificité. Résoudre une règle ainsi portée
 * suppose que le support dise son contexte de lecture : la colonne est le
 * support naturel de cette portée, et `rule-checks.ts` la lit déjà. Elle est
 * donc justifiée par D3.5, non par A5.6, et cette note tient lieu de mandat.
 */
export const SUPPORT_CONTEXT_MANDATE =
  'D3.5 — portée de règle, entre `supportRegistry` et `sectorKey` dans l’ordre de spécificité.';

/**
 * Colonnes d'identité et de rattachement de `support`, que le socle écrit à la
 * création et que ni 02 ni 04 ne modifient ensuite.
 */
export const SUPPORT_IDENTITY_COLUMNS: readonly string[] = [
  'id', 'org_id', 'site_id', 'created_at', 'updated_at', 'deleted_at',
];

/**
 * La seule table du modèle dont la propriété se décide colonne par colonne.
 *
 * La nommer ici plutôt qu'au fil du code évite que le cas particulier se
 * disperse : `buildCommand` la traite à part, et rien d'autre.
 */
export const SPLIT_OWNERSHIP_TABLE = 'support';

/**
 * Le module qui possède une colonne de `support`, ou `null` si L0 ne la nomme
 * pas.
 *
 * Une colonne sans propriétaire déclaré n'appartient à personne : elle n'est
 * écrite par aucune commande. C'est le cas aujourd'hui de `kind`, et des
 * colonnes d'identité, que L0 réserve à la création — laquelle n'a pas encore
 * de module émetteur. Le silence se lit donc comme un refus, jamais comme une
 * permission.
 */
export function supportColumnOwner(column: string): ModuleKey | null {
  return SUPPORT_COLUMN_OWNER[column] ?? null;
}

/** INT-1 et INT-2, appliqués à la table scindée. */
export function ownsSupportColumn(module: ModuleKey, column: string): boolean {
  return supportColumnOwner(column) === module;
}

// ---------------------------------------------------------------------------
// INT-3 — dépendance descendante : ce que chaque module lit
// ---------------------------------------------------------------------------

/**
 * Les modules dont chaque module lit les données, selon la rubrique « Lit » de
 * L3. « Une couche lit les couches inférieures, jamais les supérieures. Un
 * cycle est une erreur de conception, jamais un cas à gérer. »
 */
export const MODULE_READS: Readonly<Record<ModuleKey, readonly ModuleKey[]>> = {
  '01-socle': [],
  '02-wayfinding': ['01-socle', '03-parcours'],
  '03-parcours': ['01-socle', '09-budget'],
  '04-signaletique': ['01-socle', '02-wayfinding'],
  '05-regie': ['01-socle', '03-parcours'],
  '06-enseignes': ['01-socle'],
  '07-chantier': ['04-signaletique'],
  '08-exploitation': ['04-signaletique', '07-chantier'],
  '09-budget': ['04-signaletique', '07-chantier', '08-exploitation', '05-regie'],
  '10-portefeuille': [...MODULE_KEYS].filter(k => k !== '10-portefeuille'),
  '11-transverse': [...MODULE_KEYS].filter(k => k !== '11-transverse'),
  '12-atelier': ['01-socle', '02-wayfinding', '04-signaletique', '05-regie'],
};

/**
 * Les deux lectures que L3 déclare et qui remontent d'une couche.
 *
 * Ce ne sont pas des manquements à INT-3 : les fiches de la partie L
 * les posent explicitement,
 * et chacune est conditionnelle. Les recenser ici les rend opposables, au lieu
 * de les laisser passer pour des oublis.
 */
export const DECLARED_UPWARD_READS: readonly {
  readonly from: ModuleKey;
  readonly to: ModuleKey;
  readonly reason: string;
}[] = [
  {
    from: '03-parcours',
    to: '09-budget',
    reason: 'L3 : « Surfaces et loyers du module 09 si souscrit. » Lecture conditionnelle, et le module 03 dégrade sans elle.',
  },
  {
    from: '02-wayfinding',
    to: '03-parcours',
    reason: 'L3 : « Profils et points de décision du module 03. » Même couche, non supérieure : L2 range 02 et 03 en couche 1.',
  },
];

// ---------------------------------------------------------------------------
// INT-4 — dégradation déclarée
// ---------------------------------------------------------------------------

/**
 * « Chaque module dit ce qu'il devient quand un module dont il dépend n'est
 * pas souscrit. Le comportement dégradé est spécifié, jamais improvisé, et
 * jamais silencieux. » Rubrique « Si absent » de L3, en substance.
 */
export const DEGRADATION_WHEN_ABSENT: Readonly<Record<ModuleKey, string>> = {
  '01-socle': 'Impossible. Aucun module ne fonctionne sans lui ; il n’entre pas dans le modèle de droits.',
  '02-wayfinding': 'La signalétique ne peut pas composer : le tableau des messages est le seul producteur de contenu de face.',
  '03-parcours': 'Le wayfinding calcule ses points de décision avec un profil par défaut unique, non paramétrable, et le signale. La régie perd la tarification indexée sur l’exposition et retombe sur une grille saisie à la main.',
  '04-signaletique': 'Le wayfinding reste utilisable seul et se vend comme prestation d’audit et de stratégie.',
  '05-regie': 'Sans effet sur les autres modules.',
  '06-enseignes': 'Sans effet sur les autres modules.',
  '07-chantier': 'Les supports posés se saisissent à la main dans le module 08. La divergence est détectée sans que son origine soit connue.',
  '08-exploitation': 'Le produit perd sa raison d’abonnement et redevient un outil de conception vendu au projet.',
  '09-budget': 'Le quantitatif reste produit, sans valorisation.',
  '10-portefeuille': 'Chaque site vit isolément, les bibliothèques se dupliquent.',
  '11-transverse': 'Non optionnel.',
  '12-atelier': 'Sans objet. L’atelier n’est pas optionnel.',
};

// ---------------------------------------------------------------------------
// Ce que les quatorze documents n'attribuent pas
// ---------------------------------------------------------------------------

/**
 * Tables du schéma qu'aucune fiche de L3 ne range sous un module.
 *
 * INT-1 dit qu'une entité sans propriétaire déclaré ne peut pas être
 * créée. Ces
 * tables existent pourtant. Les inscrire ici, avec leur motif, rend le manque
 * visible et opposable : une table nouvelle doit être attribuée ou justifiée
 * ici, sans quoi le contrôle de INT-1 échoue.
 */
export const TABLES_WITHOUT_DECLARED_OWNER: Readonly<Record<string, string>> = {
  organization: 'A5.1, accès et cloisonnement. N’appartient à aucun module : c’est la frontière dans laquelle les modules vivent.',
  membership: 'A5.1, même motif que `organization`.',
  rules_pack: 'A5.9 et D3. Paquet de règles, donnée versionnée globale, sans org_id ; aucune fiche de L3 ne le range.',
  rules_pack_rule: 'A5.9 et D3, même motif que `rules_pack`.',
  site_rules_binding: 'Rattachement d’un site à un paquet de règles. Aucune fiche de L3 ne le range.',
  charter: 'A5.7, charte de site. L3 ne donne les chartes qu’au module 10, et seulement « de groupe ».',
  charter_color: 'A5.7, même motif que `charter`.',
  charter_typeface: 'A5.7, même motif que `charter`.',
  charter_rule: 'A5.7, même motif que `charter`.',
  lexicon_term: 'A5.8, lexique de site. Aucune fiche de L3 ne le range.',
  kiosk: 'D10 et A5. Bornes : la partie H les traite, L3 n’en fait le bien d’aucun module.',
  kiosk_package: 'D10, même motif que `kiosk`.',
  kiosk_telemetry: 'D10, même motif que `kiosk`.',
  delivery_package: 'D11, archive de livraison. Artefact de sortie, rangé par aucune fiche.',
  job: 'A5.10, file de travaux. Infrastructure, non métier.',
  audit_log: 'A5.10 et A12.3, journal d’audit en insertion seule. X4 le distingue du journal d’activité du module 11, sans l’y ranger.',
  support: 'Scindée entre les modules 02 et 04, colonne par colonne (L0). Voir `SUPPORT_COLUMN_OWNER` : elle a deux propriétaires, pas aucun.',
  control_point: 'Complément « atelier », hors des quatorze documents. Son vocabulaire n’est pas celui de L.',
  site_fact: 'Complément « atelier », même motif.',
  site_fact_forbidden_word: 'Complément « atelier », même motif.',
  source_claim: 'Complément « atelier », même motif.',
  discrepancy_decision: 'Complément « atelier », même motif.',
  parking: 'Complément « atelier », même motif.',
  parking_space: 'Complément « atelier », même motif.',
  parking_uncovered_area: 'Complément « atelier », même motif.',
  vehicle_gate: 'Complément « atelier », même motif.',
};
