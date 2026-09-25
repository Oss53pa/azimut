/**
 * Modules 05 à 09 lus depuis la base (famille C) : états de lecture communs,
 * et ce que le dépôt de référence sert à la place.
 *
 * Fragment du catalogue. La table française porte le jeu de clés ;
 * la table anglaise est typée contre elle, une traduction manquante
 * ne compile pas.
 */
export const PRODUCTION_DATA_FR = {
  'registry.loading': 'Lecture des données du module en cours.',
  'registry.failed': 'Les données du module sont illisibles : rien ne s’affiche plutôt qu’un module supposé vide.',
  'registry.failed.hint': 'Vérifier la connexion à la base, puis rouvrir le site.',
  'demo.reference.hint': 'Dépôt de référence : les valeurs affichées sont synthétiques, les contrôles qui s’y appliquent sont réels. Sur une base, l’écran lit les tables du module.',

  'ads.nospec': 'Aucune fiche technique n’est générée : la conformité des visuels n’est pas contrôlée.',
  'ads.nospec.hint': 'La fiche se génère depuis l’emplacement (H4.2) et ne se saisit pas ; aucun générateur n’existe encore.',
  'adcreatives.control.unchecked': 'Non contrôlé',
  'adcreatives.col.origin': 'Origine',
  'adcreatives.origin.stored': 'Enregistré',
  'adcreatives.origin.received': 'En réception',

  'tenant.regulation.none': 'Aucune version du règlement n’était en vigueur à ce dépôt : le dossier ne s’instruit contre rien.',
  'tenant.regulation.none.hint': 'Une version du règlement s’applique aux dossiers déposés à partir de sa date d’effet.',
  'tenant.regulation.version': 'Version en vigueur depuis le {date}',
  'tenant.destination.missing': 'Destination introuvable',
} as const;

export const PRODUCTION_DATA_EN: Readonly<Record<keyof typeof PRODUCTION_DATA_FR, string>> = {
  'registry.loading': 'Reading the module’s data.',
  'registry.failed': 'The module’s data cannot be read: nothing is shown rather than a module assumed empty.',
  'registry.failed.hint': 'Check the database connection, then reopen the site.',
  'demo.reference.hint': 'Reference repository: the values shown are synthetic, the checks applied to them are real. Against a database, the screen reads the module’s tables.',

  'ads.nospec': 'No technical sheet is generated: creatives are not checked for compliance.',
  'ads.nospec.hint': 'The sheet is generated from the placement (H4.2), never entered; no generator exists yet.',
  'adcreatives.control.unchecked': 'Not checked',
  'adcreatives.col.origin': 'Origin',
  'adcreatives.origin.stored': 'Stored',
  'adcreatives.origin.received': 'In intake',

  'tenant.regulation.none': 'No version of the regulation was in force at this submission: the dossier is instructed against nothing.',
  'tenant.regulation.none.hint': 'A version of the regulation applies to dossiers submitted from its effective date.',
  'tenant.regulation.version': 'Version in force since {date}',
  'tenant.destination.missing': 'Destination not found',
};
