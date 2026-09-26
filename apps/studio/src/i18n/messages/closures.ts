/**
 * A5.3 — fermetures d'arêtes : saisie d'un instant simulé, liste des
 * fermetures déclarées, et ce que les créneaux de pose en voient. Et T-2.9 :
 * ce que dit l'écran des plans muraux quand aucun emplacement n'est déclaré.
 *
 * Fragment du catalogue. La table française porte le jeu de clés ;
 * la table anglaise est typée contre elle, une traduction manquante
 * ne compile pas.
 */
export const CLOSURES_FR = {
  'closures.at.label': 'Instant simulé, heure locale du site',
  'closures.at.hint': 'AAAA-MM-JJTHH:MM:SS. Vide : les fermetures temporaires ne comptent pas, comme pour les rendus imprimés.',
  'closures.at.invalid': 'Format attendu : AAAA-MM-JJTHH:MM:SS.',
  'closures.active': '{count} arête(s) fermée(s) à cet instant : les itinéraires comptés ci-dessous les évitent.',
  'closures.panel': 'Fermetures déclarées',
  'closures.empty': 'Aucune fermeture déclarée sur le graphe.',
  'closures.col.edge': 'Arête',
  'closures.col.from': 'Du',
  'closures.col.to': 'Au',
  'closures.col.reason': 'Motif',
  'closures.unreadable': 'Disponibilité illisible : fermée à tout instant',
  'closures.note': 'Une fermeture ne compte qu’à un instant donné. Le tableau des messages, les panneaux et les plans d’évacuation, imprimés et durables, ne la voient pas ; un contrôle signale un chemin d’évacuation touché.',
  'evacuation.closures': '{count} fermeture(s) déclarée(s) touchent un chemin d’évacuation. Le plan ne les montre pas : il est durable ; décider de la conduite à tenir pendant la période.',
  'wallplans.empty': 'Aucun support ne porte de plan mural. Un emplacement de plan mural se déclare par un bloc « plan » (map) sur une face du support.',
  'worksiteslots.section.closures': 'Fermetures le jour de pose',
  'worksiteslots.closures.none': 'Aucune fermeture ce jour-là autour des supports du créneau.',
  'worksiteslots.closures.undated': 'Créneau sans date : rien à croiser avec les fermetures.',
} as const;

export const CLOSURES_EN: Readonly<Record<keyof typeof CLOSURES_FR, string>> = {
  'closures.at.label': 'Simulated instant, site local time',
  'closures.at.hint': 'YYYY-MM-DDTHH:MM:SS. Empty: temporary closures do not count, as for printed renders.',
  'closures.at.invalid': 'Expected format: YYYY-MM-DDTHH:MM:SS.',
  'closures.active': '{count} edge(s) closed at this instant: the routes counted below avoid them.',
  'closures.panel': 'Declared closures',
  'closures.empty': 'No closure declared on the graph.',
  'closures.col.edge': 'Edge',
  'closures.col.from': 'From',
  'closures.col.to': 'To',
  'closures.col.reason': 'Reason',
  'closures.unreadable': 'Unreadable availability: closed at any instant',
  'closures.note': 'A closure only counts at a given instant. The message table, panels and evacuation plans, printed and durable, do not see it; a check reports an affected evacuation route.',
  'evacuation.closures': '{count} declared closure(s) affect an evacuation route. The plan does not show them, being durable; decide what to do during the period.',
  'wallplans.empty': 'No support carries a wall plan. A wall-plan location is declared by a “map” block on one of the support’s faces.',
  'worksiteslots.section.closures': 'Closures on the installation day',
  'worksiteslots.closures.none': 'No closure that day around the slot’s supports.',
  'worksiteslots.closures.undated': 'Undated slot: nothing to cross with closures.',
};
