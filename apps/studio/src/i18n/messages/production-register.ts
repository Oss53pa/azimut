/**
 * Module 07 aux écrans de la maquette : allotissement, planning de pose,
 * réserves.
 *
 * Fragment du catalogue. La table française porte le jeu de clés ;
 * la table anglaise est typée contre elle, une traduction manquante
 * ne compile pas.
 */
export const PRODUCTION_REGISTER_FR = {
  'nav.item.worksitelots': 'Allotissement',
  'nav.item.worksiteslots': 'Planning de pose',
  'nav.item.worksitereserves': 'Réserves',

  'worksitelots.summary': '{lots} lot(s) · {supports} supports',
  'worksitelots.filter.all': 'Tous',
  'worksitelots.shown': '{count} lot(s)',
  'worksitelots.reserves.none': 'Aucune',
  'worksitelots.reserve.label': '{reserve} · {support}',
  'worksitelots.inspector.empty': 'Choisissez un lot pour voir ses réserves.',
  'worksitelots.inspector.subtitle': '{manufacturer} · {state}',
  'worksitelots.section.computed.note': "Un lot n'est prêt à être déclaré posé qu'une fois toutes ses réserves levées.",
  'worksitelots.field.ready': 'Prêt à déclarer posé',
  'worksitelots.note': 'Un support appartient à un seul lot. Le lot fixe le fabricant, jamais le contenu des faces.',

  'worksitereserves.summary': '{count} réserve(s) · {open} ouverte(s)',
  'worksitereserves.filter.all': 'Toutes',
  'worksitereserves.filter.open': 'Ouvertes',
  'worksitereserves.filter.lifted': 'Levées',
  'worksitereserves.shown': '{count} réserve(s)',
  'worksitereserves.inspector.empty': 'Choisissez une réserve pour voir son constat.',
  'worksitereserves.inspector.subtitle': '{support} · {state}',
  'worksitereserves.section.reserve': 'Réserve',

  'worksiteslots.summary': '{count} créneau(x) · {planned} supports planifiés · {unplanned} à planifier',
  'worksiteslots.filter.all': 'Tous',
  'worksiteslots.filter.planned': 'Planifiés',
  'worksiteslots.filter.unplanned': 'À planifier',
  'worksiteslots.shown': '{count} créneau(x)',
  'worksiteslots.col.slot': 'Intervention',
  'worksiteslots.state.planned': 'planifié',
  'worksiteslots.inspector.empty': 'Choisissez un créneau pour voir sa pose.',
  'worksiteslots.inspector.subtitle': '{zone} · {shift}',
  'worksiteslots.section.slot': 'Intervention',
  'worksiteslots.note': "Les conflits avec les fermetures et les cheminements d'évacuation ne sont pas encore contrôlés : le modèle ne porte pas de plage de fermeture.",
} as const;

export const PRODUCTION_REGISTER_EN: Readonly<Record<keyof typeof PRODUCTION_REGISTER_FR, string>> = {
  'nav.item.worksitelots': 'Lots',
  'nav.item.worksiteslots': 'Installation schedule',
  'nav.item.worksitereserves': 'Reserves',

  'worksitelots.summary': '{lots} lot(s) · {supports} supports',
  'worksitelots.filter.all': 'All',
  'worksitelots.shown': '{count} lot(s)',
  'worksitelots.reserves.none': 'None',
  'worksitelots.reserve.label': '{reserve} · {support}',
  'worksitelots.inspector.empty': 'Choose a lot to see its reserves.',
  'worksitelots.inspector.subtitle': '{manufacturer} · {state}',
  'worksitelots.section.computed.note': 'A lot is ready to be declared installed only once all its reserves are lifted.',
  'worksitelots.field.ready': 'Ready to declare installed',
  'worksitelots.note': 'A support belongs to a single lot. The lot sets the manufacturer, never the face content.',

  'worksitereserves.summary': '{count} reserve(s) · {open} open',
  'worksitereserves.filter.all': 'All',
  'worksitereserves.filter.open': 'Open',
  'worksitereserves.filter.lifted': 'Lifted',
  'worksitereserves.shown': '{count} reserve(s)',
  'worksitereserves.inspector.empty': 'Choose a reserve to see its observation.',
  'worksitereserves.inspector.subtitle': '{support} · {state}',
  'worksitereserves.section.reserve': 'Reserve',

  'worksiteslots.summary': '{count} slot(s) · {planned} supports planned · {unplanned} to plan',
  'worksiteslots.filter.all': 'All',
  'worksiteslots.filter.planned': 'Planned',
  'worksiteslots.filter.unplanned': 'To plan',
  'worksiteslots.shown': '{count} slot(s)',
  'worksiteslots.col.slot': 'Job',
  'worksiteslots.state.planned': 'planned',
  'worksiteslots.inspector.empty': 'Choose a slot to see its installation.',
  'worksiteslots.inspector.subtitle': '{zone} · {shift}',
  'worksiteslots.section.slot': 'Intervention',
  'worksiteslots.note': 'Conflicts with closures and evacuation routes are not checked yet: the model carries no closure period.',
} as const;
