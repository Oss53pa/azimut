/**
 * T-1.13 — la reprise d'un carnet de supports existant.
 *
 * Fragment du catalogue. La table française porte le jeu de clés ;
 * la table anglaise est typée contre elle, une traduction manquante
 * ne compile pas.
 */
export const CARNET_IMPORT_FR = {
  'carnet.panel': 'Reprendre un carnet existant',
  'carnet.note': 'Tableur CSV en UTF-8, colonnes de D4.1. Les lignes valides s’importent, les autres restent au rapport.',
  'carnet.file': 'Fichier du carnet',
  'carnet.decimal': 'Séparateur décimal',
  'carnet.decimal.point': 'Point (12.5)',
  'carnet.decimal.comma': 'Virgule (12,5)',
  'carnet.summary': '{total} ligne(s) : {ready} prête(s), {pending} en attente, {rejected} rejetée(s).',
  'carnet.col.row': 'Ligne',
  'carnet.col.reference': 'Référence',
  'carnet.col.status': 'État',
  'carnet.col.detail': 'Détail',
  'carnet.status.ready': 'prête',
  'carnet.status.pending': 'en attente',
  'carnet.status.rejected': 'rejetée',
  'carnet.import': 'Importer les {count} ligne(s) prête(s)',
  'carnet.done': 'Carnet importé : les lignes prêtes sont écrites.',
  'carnet.readonly': 'Aucun dépôt n’est configuré : le rapport se lit, rien ne s’écrit.',
  'carnet.kept': 'Contenu constaté et substrat restent au rapport ; ils ne sont pas enregistrés.',
} as const;

export const CARNET_IMPORT_EN: Readonly<Record<keyof typeof CARNET_IMPORT_FR, string>> = {
  'carnet.panel': 'Take over an existing sign schedule',
  'carnet.note': 'UTF-8 CSV spreadsheet, D4.1 columns. Valid rows are imported, the others stay in the report.',
  'carnet.file': 'Schedule file',
  'carnet.decimal': 'Decimal separator',
  'carnet.decimal.point': 'Point (12.5)',
  'carnet.decimal.comma': 'Comma (12,5)',
  'carnet.summary': '{total} row(s): {ready} ready, {pending} pending, {rejected} rejected.',
  'carnet.col.row': 'Row',
  'carnet.col.reference': 'Reference',
  'carnet.col.status': 'Status',
  'carnet.col.detail': 'Detail',
  'carnet.status.ready': 'ready',
  'carnet.status.pending': 'pending',
  'carnet.status.rejected': 'rejected',
  'carnet.import': 'Import the {count} ready row(s)',
  'carnet.done': 'Schedule imported: the ready rows are written.',
  'carnet.readonly': 'No repository is configured: the report can be read, nothing is written.',
  'carnet.kept': 'Observed content and substrate stay in the report; they are not stored.',
};
