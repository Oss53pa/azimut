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
} as const;

export const PRODUCTION_DATA_EN: Readonly<Record<keyof typeof PRODUCTION_DATA_FR, string>> = {
  'registry.loading': 'Reading the module’s data.',
  'registry.failed': 'The module’s data cannot be read: nothing is shown rather than a module assumed empty.',
  'registry.failed.hint': 'Check the database connection, then reopen the site.',
  'demo.reference.hint': 'Reference repository: the values shown are synthetic, the checks applied to them are real. Against a database, the screen reads the module’s tables.',
};
