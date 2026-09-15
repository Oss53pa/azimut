/**
 * D12.1 / H2 — module 02, le tableau des messages.
 *
 * Fragment du catalogue. La table française porte le jeu de clés ;
 * la table anglaise est typée contre elle.
 */
export const WAYFINDING_FR = {
  'schedule.eyebrow': 'Module 02 · H2.5',
  'schedule.title': 'Tableau des messages',
  'schedule.subtitle': 'Message schedule',
  'schedule.noprofile': "Le site ne déclare aucun profil de déplacement : aucun point de décision ne peut être calculé, donc aucune ligne.",

  'schedule.metric.version': 'Version',
  'schedule.metric.state': 'État',
  'schedule.metric.hash': 'Empreinte des entrées',
  'schedule.metric.lines': 'Lignes',
  'schedule.metric.stale': 'Périmées',
  'schedule.metric.supports': 'Supports',

  'schedule.action.csv': 'Export tableur',
  'schedule.action.document': 'Export document',

  'schedule.trial.message': "Implantation d'essai : {count} support(s) posés sur les points de décision calculés.",
  'schedule.trial.hint': "Le site ne porte aucun support implanté. Rien n'est écrit : dès qu'une implantation existera, elle prendra la place de celle-ci.",
  'schedule.stale.message': '{count} ligne(s) périmée(s). Le moteur de composition ne consommera que les lignes à jour.',

  'schedule.filter.typology': 'Typologie',
  'schedule.filter.level': "Niveau d'information",
  'schedule.filter.level.all': 'Tous',
  'schedule.filter.staleonly': 'Périmées seulement',
  'schedule.filter.shown': '{shown} ligne(s) sur {total}',

  'schedule.panel.lines': 'Lignes du tableau',
  'schedule.panel.lines.note': 'une ligne par bloc résolu',
  'schedule.panel.generation': 'Génération et contrôles',
  'schedule.panel.generation.empty': 'Aucune anomalie de génération.',
  'schedule.panel.continuity': 'Continuité du message',
  'schedule.panel.continuity.empty': 'Aucune rupture de continuité détectée.',
  'schedule.panel.naming': 'Collisions de nommage',
  'schedule.panel.naming.empty': "Aucune collision de nom d'orientation.",
  'schedule.panel.rules': 'Règles déclarées du site',

  'schedule.rules.maxdestinations': 'Destinations max par face',
  'schedule.rules.unchecked': 'Non contrôlé',
  'schedule.rules.checked': 'Contrôlé',
  'schedule.rules.note': "Une règle absente vaut « non contrôlée ». Aucun seuil n'est inventé à la place.",

  'schedule.levels.title': "Niveaux d'information par typologie",
  'schedule.levels.note': 'H2.3 · déclaré, jamais déduit',
  'schedule.levels.help': "Aucune colonne du modèle ne porte encore ce rattachement : la déclaration vaut pour la session. Une typologie non déclarée produit WAYFIND.NO_INFORMATION_LEVEL, elle ne reçoit pas un niveau par défaut.",
  'schedule.level.1': '1 Identification',
  'schedule.level.2': '2 Orientation',
  'schedule.level.3': '3 Direction',
  'schedule.level.4': '4 Confirmation',

  'schedule.col.line': 'Ligne',
  'schedule.col.position': 'Support · face · bloc',
  'schedule.col.fr': 'Contenu FR',
  'schedule.col.en': 'Contenu EN',
  'schedule.col.pictogram': 'Picto',
  'schedule.col.direction': 'Dir.',
  'schedule.col.level': 'Niv.',
  'schedule.col.decisionpoint': 'Point de décision',
  'schedule.col.state': 'État',
  'schedule.state.stale': 'périmée',
  'schedule.state.current': 'à jour',
  'schedule.table.empty': 'Aucune ligne ne correspond au filtre.',

  'schedule.note': "Le tableau s'intercale entre le graphe et la composition : c'est lui que la maîtrise d'ouvrage valide, et c'est lui que le moteur de composition consomme. Aucun contenu de face n'est saisi ici.",
} as const;

export const WAYFINDING_EN: Readonly<Record<keyof typeof WAYFINDING_FR, string>> = {
  'schedule.eyebrow': 'Module 02 · H2.5',
  'schedule.title': 'Message schedule',
  'schedule.subtitle': 'Tableau des messages',
  'schedule.noprofile': 'The site declares no travel profile: no decision point can be computed, so no line either.',

  'schedule.metric.version': 'Version',
  'schedule.metric.state': 'State',
  'schedule.metric.hash': 'Inputs fingerprint',
  'schedule.metric.lines': 'Lines',
  'schedule.metric.stale': 'Stale',
  'schedule.metric.supports': 'Supports',

  'schedule.action.csv': 'Spreadsheet export',
  'schedule.action.document': 'Document export',

  'schedule.trial.message': 'Trial placement: {count} support(s) set on the computed decision points.',
  'schedule.trial.hint': 'The site carries no placed support. Nothing is written: a real placement replaces this one as soon as it exists.',
  'schedule.stale.message': '{count} stale line(s). The composition engine consumes current lines only.',

  'schedule.filter.typology': 'Typology',
  'schedule.filter.level': 'Information level',
  'schedule.filter.level.all': 'All',
  'schedule.filter.staleonly': 'Stale only',
  'schedule.filter.shown': '{shown} line(s) of {total}',

  'schedule.panel.lines': 'Schedule lines',
  'schedule.panel.lines.note': 'one line per resolved block',
  'schedule.panel.generation': 'Generation and checks',
  'schedule.panel.generation.empty': 'No generation anomaly.',
  'schedule.panel.continuity': 'Message continuity',
  'schedule.panel.continuity.empty': 'No continuity break detected.',
  'schedule.panel.naming': 'Naming collisions',
  'schedule.panel.naming.empty': 'No orientation-name collision.',
  'schedule.panel.rules': 'Declared site rules',

  'schedule.rules.maxdestinations': 'Max destinations per face',
  'schedule.rules.unchecked': 'Not checked',
  'schedule.rules.checked': 'Checked',
  'schedule.rules.note': 'A missing rule means "not checked". No threshold is invented in its place.',

  'schedule.levels.title': 'Information levels per typology',
  'schedule.levels.note': 'H2.3 · declared, never inferred',
  'schedule.levels.help': 'No model column carries this attachment yet: the declaration holds for the session. An undeclared typology raises WAYFIND.NO_INFORMATION_LEVEL rather than receiving a default level.',
  'schedule.level.1': '1 Identification',
  'schedule.level.2': '2 Orientation',
  'schedule.level.3': '3 Direction',
  'schedule.level.4': '4 Confirmation',

  'schedule.col.line': 'Line',
  'schedule.col.position': 'Support · face · block',
  'schedule.col.fr': 'Content FR',
  'schedule.col.en': 'Content EN',
  'schedule.col.pictogram': 'Picto',
  'schedule.col.direction': 'Dir.',
  'schedule.col.level': 'Lvl',
  'schedule.col.decisionpoint': 'Decision point',
  'schedule.col.state': 'State',
  'schedule.state.stale': 'stale',
  'schedule.state.current': 'current',
  'schedule.table.empty': 'No line matches the filter.',

  'schedule.note': 'The schedule sits between the graph and composition: the client validates it, and the composition engine consumes it. No face content is entered here.',
};
