/**
 * B5 — la validation demandée au service (0085, M02.W11).
 *
 * Fragment du catalogue. La table française porte le jeu de clés ;
 * la table anglaise est typée contre elle, une traduction manquante
 * ne compile pas.
 */
export const SERVICE_VALIDATION_FR = {
  'valid.service.queued': 'Validation demandée au service de compilation : en file d’attente.',
  'valid.service.running': 'Le service de compilation valide le graphe.',
  'valid.service.waiting': 'Le service n’a pas encore traité la demande. Elle reste en file ; la soumission du tableau des messages attendra son passage.',
  'valid.service.failed': 'Le service n’a pas pu valider le graphe. Relancez la validation ; si l’échec persiste, signalez-le à l’administrateur.',
  'valid.service.unavailable': 'La demande n’a pas pu être transmise au service. Vérifiez la connexion, puis relancez.',
} as const;

export const SERVICE_VALIDATION_EN: Readonly<Record<keyof typeof SERVICE_VALIDATION_FR, string>> = {
  'valid.service.queued': 'Validation requested from the compiler service: queued.',
  'valid.service.running': 'The compiler service is validating the graph.',
  'valid.service.waiting': 'The service has not processed the request yet. It stays queued; submitting the message schedule waits for its run.',
  'valid.service.failed': 'The service could not validate the graph. Run the validation again; if it keeps failing, tell your administrator.',
  'valid.service.unavailable': 'The request could not reach the service. Check the connection, then run again.',
};
