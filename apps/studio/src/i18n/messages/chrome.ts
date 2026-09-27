/**
 * D12.1 — Chrome de l'application : navigation, barre d'en-tête, libellés de sévérité.
 *
 * Fragment du catalogue. La table française porte le jeu de clés ;
 * la table anglaise est typée contre elle, une traduction manquante
 * ne compile pas.
 */
export const CHROME_FR = {
  // Navigation chrome
  'nav.aria.main': 'Navigation principale',
  'nav.section.general': 'Général',
  'nav.section.data': 'Données',
  'nav.section.renders': 'Rendus',
  'nav.section.quality': 'Qualité',
  'nav.item.editor': 'Tracé',
  'nav.item.graph': 'Graphe',
  'nav.item.destinations': 'Occupants',
  'nav.item.supports': 'Supports',
  'nav.item.templates': 'Gabarits',
  'nav.item.floorplans': 'Plans de niveaux',
  'nav.item.faces': 'Faces',
  'nav.item.checks': 'Contrôles',
  'nav.item.proofs': 'BAT',

  // Header bar
  'header.product': 'Azimut',
  'header.building.fallback': 'Site',
  'header.publish.ready': 'Aucune anomalie bloquante ouverte.',
  'header.publish.blocked': 'Publication refusée : {count} anomalie(s) bloquante(s) ouverte(s).',
  'header.publish.unreadable': 'Publication refusée : le vocabulaire du site n’a pas pu être lu ({code}). Un registre illisible n’est pas un registre vide.',
  'header.publish.loading': 'Publication en attente : le vocabulaire du site est en cours de lecture.',
  'header.publish.unchecked': '{count} contrôle(s) n’ont pas pu être exercés, faute de paquet de règles.',
  'header.action.openaudit': "Ouvrir l'audit",
  'header.action.publish': 'Publier',

  // Severity labels (shared)
  'severity.blocking': 'Bloquant',
  'severity.warning': 'Avertissement',
  'severity.info': 'Information',
} as const;

export const CHROME_EN: Readonly<Record<keyof typeof CHROME_FR, string>> = {
  'nav.aria.main': 'Main navigation',
  'nav.section.general': 'General',
  'nav.section.data': 'Data',
  'nav.section.renders': 'Renders',
  'nav.section.quality': 'Quality',
  'nav.item.editor': 'Drawing',
  'nav.item.graph': 'Graph',
  'nav.item.destinations': 'Occupants',
  'nav.item.supports': 'Supports',
  'nav.item.templates': 'Templates',
  'nav.item.floorplans': 'Floor plans',
  'nav.item.faces': 'Faces',
  'nav.item.checks': 'Checks',
  'nav.item.proofs': 'Proofs',

  'header.product': 'Azimut',
  'header.building.fallback': 'Site',
  'header.publish.ready': 'No open blocking anomaly.',
  'header.publish.blocked': 'Publishing refused: {count} open blocking anomaly(ies).',
  'header.publish.unreadable': 'Publishing refused: the site vocabulary could not be read ({code}). An unreadable registry is not an empty one.',
  'header.publish.loading': 'Publishing on hold: the site vocabulary is still loading.',
  'header.publish.unchecked': '{count} check(s) could not be run, for want of a rules pack.',
  'header.action.openaudit': 'Open audit',
  'header.action.publish': 'Publish',

  'severity.blocking': 'Blocking',
  'severity.warning': 'Warning',
  'severity.info': 'Info',
};
