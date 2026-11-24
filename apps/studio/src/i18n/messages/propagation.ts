/**
 * S6.5, S-21 — les incohérences introduites par des commandes reçues.
 *
 * Fragment du catalogue. La table française porte le jeu de clés ;
 * la table anglaise est typée contre elle, une traduction manquante
 * ne compile pas.
 */
export const PROPAGATION_FR = {
  'propagation.blocking': '{count} anomalie(s) bloquante(s) introduite(s) dans le graphe par des modifications reçues d’autres postes — commande(s) n° {commands} du journal.',
  'propagation.blocking.hint': 'La publication attend une nouvelle validation du graphe.',
} as const;

export const PROPAGATION_EN: Readonly<Record<keyof typeof PROPAGATION_FR, string>> = {
  'propagation.blocking': '{count} blocking finding(s) introduced in the graph by changes received from other workstations — journal command(s) no. {commands}.',
  'propagation.blocking.hint': 'Publication waits for a new graph validation.',
};
