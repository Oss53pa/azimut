/**
 * F5.2 — l'état de synchronisation dans la barre d'état de l'atelier.
 *
 * Fragment du catalogue. La table française porte le jeu de clés ;
 * la table anglaise est typée contre elle, une traduction manquante
 * ne compile pas.
 */
export const SYNC_STATUS_FR = {
  'sync.label': 'Synchronisation',
  'sync.local': 'locale, aucune base configurée',
  'sync.pending': '{count} geste(s) en attente d’envoi',
  'sync.direct': 'sans suivi, aucune session ouverte',
  'sync.unreachable': 'journal injoignable, les écritures des autres n’arrivent plus',
  'sync.synced': 'à jour',
} as const;

export const SYNC_STATUS_EN: Readonly<Record<keyof typeof SYNC_STATUS_FR, string>> = {
  'sync.label': 'Synchronisation',
  'sync.local': 'local, no database configured',
  'sync.pending': '{count} action(s) waiting to be sent',
  'sync.direct': 'not followed, no session open',
  'sync.unreachable': 'journal unreachable, others’ writes no longer arrive',
  'sync.synced': 'up to date',
};
