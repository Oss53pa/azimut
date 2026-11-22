/**
 * S6.7b, G4.2 — les présents du niveau dans la barre d'état.
 *
 * Fragment du catalogue. La table française porte le jeu de clés ;
 * la table anglaise est typée contre elle, une traduction manquante
 * ne compile pas.
 */
export const PRESENCE_FR = {
  'presence.label': 'Présents',
  'presence.none': 'personne d’autre sur ce niveau',
  'presence.changed': '{who}, modifié à {time}',
  'presence.unchanged': '{who}, sans modification',
} as const;

export const PRESENCE_EN: Readonly<Record<keyof typeof PRESENCE_FR, string>> = {
  'presence.label': 'Present',
  'presence.none': 'nobody else on this level',
  'presence.changed': '{who}, changed at {time}',
  'presence.unchanged': '{who}, no change',
};
